import {
  getWorkScheduleForDate,
  isOffDay,
  jakartaWeekday,
  todayDateStringJakarta,
} from './workScheduleRules.js';
import { getOvertimeBalance, getReplaceOffBalance } from './ledgerService.js';

const VALID_FUNDING_SOURCES = new Set(['replace_off', 'overtime', 'unpaid']);
const VALID_PAID_SOURCES = new Set(['replace_off', 'overtime', 'unpaid']);

export const RO_FULL_DAY_MIN_HOURS_WEEKDAY = 8;
export const RO_FULL_DAY_MIN_HOURS_SATURDAY = 6;

export function formatTimeHHmm(timeVal) {
  if (!timeVal) return null;
  const str = String(timeVal);
  if (/^\d{2}:\d{2}$/.test(str)) return str;
  const match = str.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

export function normalizeDurationType(durationType) {
  if (durationType === 'half_day_morning' || durationType === 'half_day_afternoon') {
    return 'partial';
  }
  return durationType;
}

export function isPartialDuration(durationType) {
  const n = normalizeDurationType(durationType);
  return n === 'partial';
}

export function computeLeaveDurationHours(startTime, endTime) {
  const start = formatTimeHHmm(startTime);
  const end = formatTimeHHmm(endTime);
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startM = sh * 60 + sm;
  const endM = eh * 60 + em;
  if (endM <= startM) {
    const error = new Error('Jam selesai harus setelah jam mulai');
    error.statusCode = 422;
    throw error;
  }
  return Math.round(((endM - startM) / 60) * 100) / 100;
}

export async function getDefaultWorkHoursForDate(dateStr) {
  if (await isOffDay(dateStr)) {
    const error = new Error('Tanggal bukan hari kerja');
    error.statusCode = 422;
    throw error;
  }

  const { schedule } = await getWorkScheduleForDate(dateStr);
  if (schedule?.start_time && schedule?.end_time) {
    return {
      start_time: formatTimeHHmm(schedule.start_time),
      end_time: formatTimeHHmm(schedule.end_time),
    };
  }

  const dow = jakartaWeekday(dateStr);
  if (dow === 0) {
    const error = new Error('Tanggal bukan hari kerja');
    error.statusCode = 422;
    throw error;
  }
  if (dow === 6) {
    return { start_time: '08:00', end_time: '14:00' };
  }
  return { start_time: '08:00', end_time: '17:00' };
}

export function assertIzinSameDayRules(leaveType, durationType, startDate) {
  if (leaveType !== 'izin') return;
  const today = todayDateStringJakarta();
  if (startDate === today && !isPartialDuration(durationType)) {
    const error = new Error('Izin hari ini hanya boleh partial (pilih jam), tidak boleh seharian penuh');
    error.statusCode = 422;
    throw error;
  }
}

export function getRoFullDayMinHours(dateStr) {
  const dow = jakartaWeekday(dateStr);
  if (dow === 6) return RO_FULL_DAY_MIN_HOURS_SATURDAY;
  return RO_FULL_DAY_MIN_HOURS_WEEKDAY;
}

export function assertRoFundingAllowed({ durationType, startDate, roBalance, paidSource }) {
  if (paidSource !== 'replace_off') return;
  if (normalizeDurationType(durationType) !== 'full_day') return;

  const minHours = getRoFullDayMinHours(startDate);
  const balance = Math.max(0, Number(roBalance) || 0);
  if (balance >= minHours) return;

  const dayLabel = jakartaWeekday(startDate) === 6 ? 'Sabtu' : 'Sen–Jum';
  const error = new Error(
    `Saldo Replace Off minimal ${minHours} jam untuk izin seharian (${dayLabel}). Saldo Anda: ${balance} jam.`
  );
  error.statusCode = 422;
  throw error;
}

export async function resolveLeaveTimes({
  durationType,
  startDate,
  endDate,
  startTime,
  endTime,
}) {
  const normalized = normalizeDurationType(durationType);
  const isPartial = normalized === 'partial';
  const isFullDay = normalized === 'full_day';

  if (isPartial && startDate !== endDate) {
    const error = new Error('Izin partial hanya berlaku untuk 1 hari');
    error.statusCode = 422;
    throw error;
  }

  if (isFullDay) {
    const hours = await getDefaultWorkHoursForDate(startDate);
    const durationHours =
      startDate === endDate ? computeLeaveDurationHours(hours.start_time, hours.end_time) : null;
    return {
      start_time: hours.start_time,
      end_time: hours.end_time,
      leave_duration_hours: durationHours,
      duration_type: 'full_day',
    };
  }

  if (isPartial) {
    const st = formatTimeHHmm(startTime);
    const et = formatTimeHHmm(endTime);
    if (!st || !et) {
      const error = new Error('Jam mulai dan jam selesai wajib diisi untuk izin partial');
      error.statusCode = 422;
      throw error;
    }
    const durationHours = computeLeaveDurationHours(st, et);
    return {
      start_time: st,
      end_time: et,
      leave_duration_hours: durationHours,
      duration_type: 'partial',
    };
  }

  const error = new Error('duration_type tidak valid');
  error.statusCode = 422;
  throw error;
}

export function parseFundingSources(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = [];
    }
  }
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((s) => VALID_FUNDING_SOURCES.has(s)))];
}

export function normalizePaidSource(sources) {
  const list = Array.isArray(sources) ? sources : [];
  const hasRo = list.includes('replace_off');
  const hasOt = list.includes('overtime');
  const hasUnpaid = list.includes('unpaid');

  if (hasRo && hasOt) {
    const error = new Error('Tidak boleh menggabungkan Replace Off dan Lembur dalam satu izin.');
    error.statusCode = 422;
    throw error;
  }
  if (hasRo) return 'replace_off';
  if (hasOt) return 'overtime';
  if (hasUnpaid) return 'unpaid';

  const error = new Error('Pilih sumber izin (Replace Off / Lembur / Unpaid)');
  error.statusCode = 422;
  throw error;
}

function buildFundingSourcesResult({ fundingRo, fundingOvertime, fundingUnpaid, paidSource }) {
  const sources = [];
  if (fundingRo > 0) sources.push('replace_off');
  if (fundingOvertime > 0) sources.push('overtime');
  if (fundingUnpaid > 0) sources.push('unpaid');
  if (sources.length === 0 && VALID_PAID_SOURCES.has(paidSource)) {
    sources.push(paidSource);
  }
  return sources;
}

export function computeIzinFunding({
  durationHours,
  paidSource,
  roBalance,
  overtimeBalance,
  durationType,
  startDate,
}) {
  const hours = Math.round(Number(durationHours) * 100) / 100;
  if (!Number.isFinite(hours) || hours <= 0) {
    const error = new Error('Durasi izin tidak valid');
    error.statusCode = 422;
    throw error;
  }
  if (!VALID_PAID_SOURCES.has(paidSource)) {
    const error = new Error('Pilih sumber izin (Replace Off / Lembur / Unpaid)');
    error.statusCode = 422;
    throw error;
  }

  assertRoFundingAllowed({
    durationType,
    startDate,
    roBalance,
    paidSource,
  });

  const ro = Math.max(0, Number(roBalance) || 0);
  const ot = Math.max(0, Number(overtimeBalance) || 0);

  let fundingRo = 0;
  let fundingOvertime = 0;
  let fundingUnpaid = 0;

  if (paidSource === 'unpaid') {
    fundingUnpaid = hours;
  } else if (paidSource === 'replace_off') {
    if (ro <= 0) {
      const error = new Error('Saldo Replace Off tidak tersedia. Pilih Lembur atau Unpaid.');
      error.statusCode = 422;
      throw error;
    }
    fundingRo = Math.min(hours, ro);
    fundingRo = Math.round(fundingRo * 100) / 100;
    fundingUnpaid = Math.round((hours - fundingRo) * 100) / 100;
  } else if (paidSource === 'overtime') {
    if (ot <= 0) {
      const error = new Error('Saldo Lembur tidak tersedia. Pilih Replace Off atau Unpaid.');
      error.statusCode = 422;
      throw error;
    }
    fundingOvertime = Math.min(hours, ot);
    fundingOvertime = Math.round(fundingOvertime * 100) / 100;
    fundingUnpaid = Math.round((hours - fundingOvertime) * 100) / 100;
  }

  return {
    funding_ro_hours: fundingRo,
    funding_overtime_hours: fundingOvertime,
    funding_unpaid_hours: fundingUnpaid,
    funding_sources: buildFundingSourcesResult({
      fundingRo,
      fundingOvertime,
      fundingUnpaid,
      paidSource,
    }),
  };
}

export async function resolveIzinFundingForSubmit(
  employeeId,
  durationHours,
  sources,
  { durationType, startDate } = {}
) {
  const paidSource = normalizePaidSource(sources);
  const roBalance = await getReplaceOffBalance(employeeId);
  const overtimeBalance = await getOvertimeBalance(employeeId);
  return computeIzinFunding({
    durationHours,
    paidSource,
    roBalance,
    overtimeBalance,
    durationType,
    startDate,
  });
}
