/**
 * Client-side rough preview of leave days (Sundays excluded).
 * Holidays and exact count are validated server-side on submit.
 */
const fmt = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function addDaysLocal(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return fmt(d);
}

export function countLeaveDaysClient({ startDate, endDate, durationType }) {
  const start = String(startDate || '').slice(0, 10);
  const end = String(endDate || start).slice(0, 10);
  if (!start || start > end) return 0;

  if (durationType !== 'full_day') {
    const dow = new Date(`${start}T12:00:00`).getDay();
    return dow === 0 ? 0 : 0.5;
  }

  let total = 0;
  for (let d = start; d <= end; d = addDaysLocal(d, 1)) {
    const dow = new Date(`${d}T12:00:00`).getDay();
    if (dow !== 0) total += 1;
  }
  return total;
}
