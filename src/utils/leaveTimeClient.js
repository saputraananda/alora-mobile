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

export function computeIzinFundingClient({ durationHours, sources, roBalance, overtimeBalance }) {
  const hours = Math.round(Number(durationHours) * 100) / 100;
  if (hours <= 0 || !sources?.length) {
    return { funding_ro_hours: 0, funding_overtime_hours: 0, funding_unpaid_hours: 0 };
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

  const fundingUnpaid = remaining > 0 && sources.includes('unpaid') ? remaining : 0;

  return {
    funding_ro_hours: fundingRo,
    funding_overtime_hours: fundingOvertime,
    funding_unpaid_hours: fundingUnpaid,
    uncovered: remaining > 0 && !sources.includes('unpaid') ? remaining : 0,
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
