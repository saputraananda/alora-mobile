import {
  INSIDE_LOCATION_LABEL,
  OUTSIDE_LOCATION_LABEL,
} from './attendanceLocation.js';

export const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const AVAILABLE_YEARS = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

export function toDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}/.test(s) && !s.includes('T')) return s.slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return typeof value === 'string' ? String(value).slice(0, 10) : '';
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatClock(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} WIB`;
}

export function mapItemToRecord(item) {
  const key = toDateKey(item.attendance_date);
  const inTime = formatClock(item.clock_in);
  const outTime = formatClock(item.clock_out);
  return {
    date: key,
    day: Number(key.split('-')[2] || 0),
    label: 'Hadir',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
    in: inTime || '-',
    out: outTime || '-',
    fotoMasukPath: item.foto_masuk_path || null,
    fotoKeluarPath: item.foto_keluar_path || null,
    clockIn: item.clock_in || null,
    clockOut: item.clock_out || null,
    clockInLocationName: item.clock_in_location_name || null,
    clockOutLocationName: item.clock_out_location_name || null,
    attendanceMode: item.attendance_mode || null,
    modeLocationLabel: item.mode_location_label || null,
    approvalStatus: item.approval_status || null,
    approvalPending: item.approval_pending || false,
  };
}

export function locationLabelClass(label) {
  if (label === INSIDE_LOCATION_LABEL) return 'text-[11px] text-emerald-700 font-bold mt-1 block';
  if (label === OUTSIDE_LOCATION_LABEL) return 'text-[11px] text-amber-700 font-bold mt-1 block';
  return 'text-[11px] text-slate-400 mt-1 block';
}
