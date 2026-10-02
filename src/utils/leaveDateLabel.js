const MONTH_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function parseYmd(str) {
  const parts = String(str || '').slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  if (m < 1 || m > 12 || d < 1) return null;
  return { y, m, d };
}

function formatHm(val) {
  const match = String(val || '').match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

const mon = (p) => MONTH_SHORT_ID[p.m - 1];

export function formatLeaveDateRange(startDate, endDate) {
  const s = parseYmd(startDate);
  if (!s) return '-';
  const e = parseYmd(endDate) || s;
  if (s.y === e.y && s.m === e.m && s.d === e.d) return `${s.d} ${mon(s)} ${s.y}`;
  if (s.y === e.y && s.m === e.m) return `${s.d}–${e.d} ${mon(s)} ${s.y}`;
  if (s.y === e.y) return `${s.d} ${mon(s)} – ${e.d} ${mon(e)} ${e.y}`;
  return `${s.d} ${mon(s)} ${s.y} – ${e.d} ${mon(e)} ${e.y}`;
}

export function formatLeaveDateLabel(item) {
  const start = String(item?.start_date || '').slice(0, 10);
  const end = String(item?.end_date || start).slice(0, 10);
  const range = formatLeaveDateRange(start, end);

  if (start !== end) {
    const days = Number(item?.work_days_count);
    return days > 0 ? `${range} (${days} hari kerja)` : range;
  }

  const st = formatHm(item?.start_time);
  const et = formatHm(item?.end_time);
  if (!st || !et) return range;
  if (item?.leave_duration_hours != null) {
    return `${range} · ${st}–${et} (${Number(item.leave_duration_hours)} jam)`;
  }
  return `${range} · ${st}–${et}`;
}
