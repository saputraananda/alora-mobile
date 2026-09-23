export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function currentMonthKeyWib() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  return monthKeyFromParts(year, month);
}

export function currentWibYearMonth() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  return {
    year: Number(parts.find((p) => p.type === 'year').value),
    month: Number(parts.find((p) => p.type === 'month').value),
  };
}

export function monthKeyFromParts(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function partsFromMonthKey(key) {
  const [year, month] = key.split('-').map(Number);
  return { year, month };
}

export function formatMonthLabelId(key) {
  const { year, month } = partsFromMonthKey(key);
  return `${MONTH_NAMES_ID[month - 1]} ${year}`;
}

export function initialsFromName(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function scoreForEntry(entry, sortBy) {
  if (sortBy === 'sessions') {
    return { value: entry.session_count, unit: 'sesi' };
  }
  return { value: entry.total_km, unit: 'km' };
}

export function minYearFromMonthKeys(keys, fallbackYear) {
  if (!keys?.length) return fallbackYear - 2;
  const years = keys.map((k) => partsFromMonthKey(k).year);
  return Math.min(...years, fallbackYear - 2);
}
