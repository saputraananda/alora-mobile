import {
  getWorkScheduleForDate,
  isOffDay,
  jakartaWeekday,
  todayDateStringJakarta,
} from './workScheduleRules.js';
import { getOvertimeBalance, getReplaceOffBalance } from './ledgerService.js';

const VALID_FUNDING_SOURCES = new Set(['replace_off', 'overtime', 'unpaid']);

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

export function computeIzinFunding({ durationHours, sources, roBalance, overtimeBalance }) {
  const hours = Math.round(Number(durationHours) * 100) / 100;
  if (!Number.isFinite(hours) || hours <= 0) {
    const error = new Error('Durasi izin tidak valid');
    error.statusCode = 422;
    throw error;
  }
  if (!sources?.length) {
    const error = new Error('Pilih minimal satu sumber izin (Replace Off / Lembur / Unpaid)');
    error.statusCode = 422;
    throw error;
  }

  let remaining = hours;
  let fundingRo = 0;
  let fundingOvertime = 0;

  if (sources.includes('replace_off')) {
    const use = Math.min(remaining, Math.max(0, Number(roBalance) || 0));
    fundingRo = Math.round(use * 100) / 100;
    remaining = Math.round((remaining - use) * 100) / 100;
  }

  if (sources.includes('overtime') && remaining > 0) {
    const use = Math.min(remaining, Math.max(0, Number(overtimeBalance) || 0));
    fundingOvertime = Math.round(use * 100) / 100;
    remaining = Math.round((remaining - use) * 100) / 100;
  }

  let fundingUnpaid = 0;
  if (remaining > 0) {
    if (sources.includes('unpaid')) {
      fundingUnpaid = remaining;
      remaining = 0;
    } else {
      const error = new Error(
        `Saldo Replace Off/Lembur tidak mencukupi (kurang ${remaining} jam). Centang Unpaid atau kurangi durasi.`
      );
      error.statusCode = 422;
      throw error;
    }
  }

  return {
    funding_ro_hours: fundingRo,
    funding_overtime_hours: fundingOvertime,
    funding_unpaid_hours: fundingUnpaid,
    funding_sources: sources,
  };
}

export async function resolveIzinFundingForSubmit(employeeId, durationHours, sources) {
  const roBalance = await getReplaceOffBalance(employeeId);
  const overtimeBalance = await getOvertimeBalance(employeeId);
  return computeIzinFunding({
    durationHours,
    sources,
    roBalance,
    overtimeBalance,
  });
}
