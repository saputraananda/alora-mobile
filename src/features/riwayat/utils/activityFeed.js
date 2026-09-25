import { formatClock, toDateKey } from '../../../utils/attendanceDisplay.js';

export const MAX_RANGE_DAYS = 90;

const LEAVE_TYPE_LABEL = { izin: 'Izin', sakit: 'Sakit', cuti: 'Cuti' };

const fmt2 = (n) => String(n).padStart(2, '0');

export function ymd(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${fmt2(date.getMonth() + 1)}-${fmt2(date.getDate())}`;
}

export function todayYmd() {
  return ymd(new Date());
}

export function startOfMonthYmd(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${fmt2(date.getMonth() + 1)}-01`;
}

export function endOfMonthYmd(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return ymd(last);
}

export const MONTH_LABEL_ID = [
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

const MONTH_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

/** Cutoff month/year → 26 (prev month) … 25 (selected month), YMD. */
export function getCutoffRange(month, year) {
  const m = Number(month);
  const y = Number(year);
  const start = new Date(y, m - 2, 26);
  const end = new Date(y, m - 1, 25);
  return {
    startDate: ymd(start),
    endDate: ymd(end),
  };
}

/** Active cutoff month/year: if day > 25, roll to next calendar month. */
export function getDefaultCutoff(now = new Date()) {
  const day = now.getDate();
  let cutoffMonth = now.getMonth() + 1;
  let cutoffYear = now.getFullYear();
  if (day > 25) {
    cutoffMonth += 1;
    if (cutoffMonth > 12) {
      cutoffMonth = 1;
      cutoffYear += 1;
    }
  }
  return { cutoffMonth, cutoffYear };
}

/** Format YYYY-MM-DD as `21 Sep 2026`. */
export function formatYmdShortId(ymdStr) {
  const d = parseYmd(ymdStr);
  if (!d) return ymdStr || '—';
  return `${d.getDate()} ${MONTH_SHORT_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/** Pill label e.g. `26 Agu 2026 – 25 Sep 2026`. */
export function formatCutoffPillLabel(month, year) {
  const { startDate, endDate } = getCutoffRange(month, year);
  return `${formatYmdShortId(startDate)} – ${formatYmdShortId(endDate)}`;
}

/** Format YYYY-MM-DD range as compact Indonesian label for filter bar. */
export function formatRangeLabelId(from, to) {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) return `${from || '—'} – ${to || '—'}`;
  const d1 = a.getDate();
  const d2 = b.getDate();
  const m1 = a.getMonth();
  const m2 = b.getMonth();
  const y1 = a.getFullYear();
  const y2 = b.getFullYear();
  if (y1 === y2 && m1 === m2) {
    return `${d1} – ${d2} ${MONTH_LABEL_ID[m1]}`;
  }
  if (y1 === y2) {
    return `${d1} ${MONTH_SHORT_ID[m1]} – ${d2} ${MONTH_SHORT_ID[m2]} ${y1}`;
  }
  return `${d1} ${MONTH_SHORT_ID[m1]} ${y1} – ${d2} ${MONTH_SHORT_ID[m2]} ${y2}`;
}

export function parseYmd(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, day] = s.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Inclusive day count between from and to (YYYY-MM-DD). */
export function daysInclusive(from, to) {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) return null;
  const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0);
  return Math.floor(ms / 86400000) + 1;
}

export function monthsInRange(from, to) {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b || a > b) return [];
  const out = [];
  let y = a.getFullYear();
  let m = a.getMonth() + 1;
  const endY = b.getFullYear();
  const endM = b.getMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function inRangeYmd(dateKey, from, to) {
  const key = toDateKey(dateKey);
  if (!key) return false;
  return key >= from && key <= to;
}

export function mapLeaveStatus(status) {
  const s = String(status || '');
  if (s === 'Pending_Supervisor' || s === 'Pending_HRD') return 'Menunggu';
  if (s === 'Rejected_Supervisor' || s === 'Rejected_HRD') return 'Ditolak';
  if (s === 'disetujui' || s === 'approved' || s === 'Approved') return 'Disetujui';
  return s || 'Status';
}

export function toneFromStatus(status) {
  const s = String(status || '');
  if (s === 'Pending_Supervisor' || s === 'Pending_HRD') return 'pending';
  if (s === 'Rejected_Supervisor' || s === 'Rejected_HRD') return 'reject';
  if (s === 'disetujui' || s === 'approved' || s === 'Approved') return 'ok';
  return 'neutral';
}

function clip(text, max = 80) {
  const t = String(text || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function clockHm(value) {
  const formatted = formatClock(value);
  if (!formatted) return '';
  return formatted.replace(/\s*WIB\s*$/i, '').trim();
}

export function normalizeAttendance(item) {
  if (!item?.clock_in) return null;
  const dateKey = toDateKey(item.attendance_date);
  if (!dateKey) return null;
  const dateLabel = formatYmdShortId(dateKey);
  const loc = item.clock_in_location_name || item.mode_location_label || '';
  const inHm = clockHm(item.clock_in) || '--:--';
  const outHm = clockHm(item.clock_out) || '--:--';
  const timePart = `${inHm}–${outHm} WIB`;
  const dateLine = `${dateLabel} ${timePart}`;
  const subtitle = loc ? `${dateLine} · ${loc}` : dateLine;
  const isLate =
    Number(item.late_minutes) > 0
    || Boolean(String(item.late_reason || '').trim())
    || Boolean(item.late_category);
  return {
    id: `attendance-${dateKey}`,
    kind: 'attendance',
    title: 'Absensi',
    subtitle,
    statusLabel: isLate ? 'Hadir terlambat' : 'Hadir',
    statusTone: 'ok',
    sortAt: item.clock_in || `${dateKey}T00:00:00`,
    dateKey,
  };
}

export function normalizeLeave(item) {
  if (!item?.id) return null;
  const start = toDateKey(item.start_date);
  const end = toDateKey(item.end_date) || start;
  if (!start) return null;
  const typeLabel = LEAVE_TYPE_LABEL[item.leave_type] || item.leave_type || 'Cuti/Izin';
  const reasonPart = clip(item.reason, 48);
  const rangeLabel =
    end && end !== start
      ? `${formatYmdShortId(start)} – ${formatYmdShortId(end)}`
      : formatYmdShortId(start);
  const subtitle = reasonPart ? `${rangeLabel} · ${reasonPart}` : rangeLabel;
  const status = item.status;
  return {
    id: `leave-${item.id}`,
    kind: 'leave',
    leaveType: item.leave_type || null,
    title: typeLabel,
    subtitle,
    statusLabel: mapLeaveStatus(status),
    statusTone: toneFromStatus(status),
    sortAt: item.created_at || start,
    dateKey: start,
  };
}

export function normalizeModeRequest(item, kind) {
  if (!item?.id) return null;
  const dateKey = toDateKey(item.work_date);
  if (!dateKey) return null;
  const reasonPart = clip(item.reason);
  const dateLabel = formatYmdShortId(dateKey);
  const subtitle = reasonPart ? `${dateLabel} · ${reasonPart}` : dateLabel;
  const status = item.status;
  return {
    id: `${kind}-${item.id}`,
    kind,
    title: kind === 'wod' ? 'Pengajuan WOD' : 'Pengajuan WFA',
    subtitle,
    statusLabel: item.status_label || mapLeaveStatus(status),
    statusTone: toneFromStatus(status),
    sortAt: item.created_at || dateKey,
    dateKey,
  };
}

export function normalizeLembur(item) {
  if (!item?.id) return null;
  const dateKey = toDateKey(item.work_date);
  if (!dateKey) return null;
  const timePart =
    item.start_time || item.end_time
      ? `${item.start_time || '?'}–${item.end_time || '?'}`
      : '';
  const desc = clip(item.description);
  const bits = [formatYmdShortId(dateKey), timePart, desc].filter(Boolean);
  const status = item.status;
  return {
    id: `lembur-${item.id}`,
    kind: 'lembur',
    title: 'Pengajuan Lembur',
    subtitle: bits.join(' · '),
    statusLabel: item.status_label || mapLeaveStatus(status),
    statusTone: toneFromStatus(status),
    sortAt: item.created_at || dateKey,
    dateKey,
  };
}

export function normalizeSession(item) {
  if (!item?.id) return null;
  const dateKey = toDateKey(item.work_date);
  if (!dateKey) return null;
  const inHm = clockHm(item.clock_in);
  const outHm = clockHm(item.clock_out);
  const timePart = inHm ? `${inHm}–${outHm || '…'}` : '';
  const subtitle = [formatYmdShortId(dateKey), timePart].filter(Boolean).join(' · ');
  const status = item.status;
  return {
    id: `session-${item.id}`,
    kind: 'session',
    title: item.session_type === 'lembur' ? 'Sesi Lembur' : 'Sesi RO',
    subtitle,
    statusLabel: item.status_label || mapLeaveStatus(status),
    statusTone: toneFromStatus(status),
    sortAt: item.created_at || dateKey,
    dateKey,
  };
}

function leaveOverlapsRange(item, from, to) {
  const start = toDateKey(item.start_date);
  const end = toDateKey(item.end_date) || start;
  if (!start) return false;
  return start <= to && end >= from;
}

async function settledItems(promise, mapFn, errorLabel, errors) {
  try {
    const data = await promise;
    const list = Array.isArray(data) ? data : [];
    return list.map(mapFn).filter(Boolean);
  } catch {
    errors.push(errorLabel);
    return [];
  }
}

/**
 * Fetch and merge activity feed for [from, to] inclusive YYYY-MM-DD.
 * @param {{ api: import('axios').AxiosInstance, from: string, to: string }} opts
 */
export async function fetchActivityFeed({ api, from, to }) {
  const errors = [];
  const months = monthsInRange(from, to);
  const tasks = [];

  for (const { year, month } of months) {
    tasks.push(
      settledItems(
        api.get('/attendance/month', { params: { year, month } }).then((r) => r.data?.items || []),
        (item) => {
          if (!inRangeYmd(item.attendance_date, from, to)) return null;
          return normalizeAttendance(item);
        },
        'Absensi',
        errors
      )
    );

    tasks.push(
      settledItems(
        api.get('/leave/list', { params: { limit: 50, month, year } }).then((r) => r.data?.items || []),
        (item) => {
          if (!leaveOverlapsRange(item, from, to)) return null;
          return normalizeLeave(item);
        },
        'Cuti/Izin',
        errors
      )
    );

    tasks.push(
      settledItems(
        api
          .get('/attendance-mode-requests/mine', { params: { request_type: 'wfa', month, year } })
          .then((r) => r.data?.items || []),
        (item) => {
          if (!inRangeYmd(item.work_date, from, to)) return null;
          return normalizeModeRequest(item, 'wfa');
        },
        'WFA',
        errors
      )
    );

    tasks.push(
      settledItems(
        api
          .get('/attendance-mode-requests/mine', { params: { request_type: 'wod', month, year } })
          .then((r) => r.data?.items || []),
        (item) => {
          if (!inRangeYmd(item.work_date, from, to)) return null;
          return normalizeModeRequest(item, 'wod');
        },
        'WOD',
        errors
      )
    );

    tasks.push(
      settledItems(
        api.get('/lembur-ro/list', { params: { limit: 50, month, year } }).then((r) => r.data?.items || []),
        (item) => {
          if (!inRangeYmd(item.work_date, from, to)) return null;
          return normalizeLembur(item);
        },
        'Lembur',
        errors
      )
    );

    tasks.push(
      settledItems(
        api
          .get('/attendance-sessions/list', { params: { limit: 50, month, year } })
          .then((r) => r.data?.items || []),
        (item) => {
          if (!inRangeYmd(item.work_date, from, to)) return null;
          return normalizeSession(item);
        },
        'Sesi',
        errors
      )
    );
  }

  const chunks = await Promise.all(tasks);
  const seen = new Set();
  const items = [];
  for (const item of chunks.flat()) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  items.sort((a, b) => String(b.sortAt).localeCompare(String(a.sortAt)));

  const uniqueErrors = [...new Set(errors)];
  return { items, errors: uniqueErrors };
}
