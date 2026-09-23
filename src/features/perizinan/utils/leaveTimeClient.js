export const RO_FULL_DAY_MIN_HOURS_WEEKDAY = 8;
export const RO_FULL_DAY_MIN_HOURS_SATURDAY = 6;

export function formatTimeHHmm(timeVal) {
  if (!timeVal) return null;
  const str = String(timeVal);
  if (/^\d{2}:\d{2}$/.test(str)) return str;
  const match = str.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

export function computeLeaveDurationHoursClient(startTime, endTime) {
  const start = formatTimeHHmm(startTime);
  const end = formatTimeHHmm(endTime);
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return 0;
  return Math.round((diff / 60) * 100) / 100;
}

function jakartaWeekdayClient(dateStr) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00+07:00`);
  return d.getUTCDay();
}

export function getRoFullDayMinHoursClient(dateStr) {
  const dow = jakartaWeekdayClient(dateStr);
  if (dow === 6) return RO_FULL_DAY_MIN_HOURS_SATURDAY;
  return RO_FULL_DAY_MIN_HOURS_WEEKDAY;
}

export function canUseRoForLeave({ durationType, startDate, roBalance }) {
  const balance = Math.max(0, Number(roBalance) || 0);
  if (balance <= 0) return false;
  const isFullDay = durationType === 'full_day';
  if (!isFullDay) return true;
  return balance >= getRoFullDayMinHoursClient(startDate);
}

export function computeIzinFundingClient({
  durationHours,
  paidSource,
  roBalance,
  overtimeBalance,
}) {
  const hours = Math.round(Number(durationHours) * 100) / 100;
  if (hours <= 0 || !paidSource) {
    return {
      funding_ro_hours: 0,
      funding_overtime_hours: 0,
      funding_unpaid_hours: 0,
      uncovered: 0,
      funding_sources: [],
    };
  }

  const ro = Math.max(0, Number(roBalance) || 0);
  const ot = Math.max(0, Number(overtimeBalance) || 0);

  let fundingRo = 0;
  let fundingOvertime = 0;
  let fundingUnpaid = 0;

  if (paidSource === 'unpaid') {
    fundingUnpaid = hours;
  } else if (paidSource === 'replace_off') {
    fundingRo = Math.round(Math.min(hours, ro) * 100) / 100;
    fundingUnpaid = Math.round((hours - fundingRo) * 100) / 100;
  } else if (paidSource === 'overtime') {
    fundingOvertime = Math.round(Math.min(hours, ot) * 100) / 100;
    fundingUnpaid = Math.round((hours - fundingOvertime) * 100) / 100;
  }

  const funding_sources = [];
  if (fundingRo > 0) funding_sources.push('replace_off');
  if (fundingOvertime > 0) funding_sources.push('overtime');
  if (fundingUnpaid > 0) funding_sources.push('unpaid');

  return {
    funding_ro_hours: fundingRo,
    funding_overtime_hours: fundingOvertime,
    funding_unpaid_hours: fundingUnpaid,
    uncovered: 0,
    funding_sources,
  };
}

export function isPartialDurationType(durationType) {
  return durationType === 'partial'
    || durationType === 'half_day_morning'
    || durationType === 'half_day_afternoon';
}

export function todayStrJakarta() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const jakarta = new Date(utc + 7 * 60 * 60000);
  return jakarta.toISOString().slice(0, 10);
}

export function paidSourceFromFundingItem(item) {
  const ro = Number(item?.funding_ro_hours || 0);
  const ot = Number(item?.funding_overtime_hours || 0);
  const unpaid = Number(item?.funding_unpaid_hours || 0);
  const sources = Array.isArray(item?.funding_sources) ? item.funding_sources : [];

  if (ro > 0 && ot > 0) return null;
  if (sources.includes('replace_off') && sources.includes('overtime')) return null;
  if (ro > 0 || sources.includes('replace_off')) return 'replace_off';
  if (ot > 0 || sources.includes('overtime')) return 'overtime';
  if (unpaid > 0 || sources.includes('unpaid')) return 'unpaid';
  return 'unpaid';
}
