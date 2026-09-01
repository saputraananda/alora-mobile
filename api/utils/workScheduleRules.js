import { aloraMobilePool } from '../db/pool.js';

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function jakartaWeekday(dateStr) {
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  return d.getUTCDay();
}

export function todayDateStringJakarta() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const jakarta = new Date(utc + JAKARTA_OFFSET_MS);
  return jakarta.toISOString().slice(0, 10);
}

export function addDaysDateString(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getWorkScheduleForDay(dayOfWeek) {
  const [rows] = await aloraMobilePool.query(
    `SELECT day_of_week, start_time, end_time, work_hours, late_tolerance_time, is_working_day
     FROM mst_work_schedule WHERE day_of_week = ? LIMIT 1`,
    [dayOfWeek]
  );
  return rows[0] || null;
}

export async function getWorkScheduleForDate(dateStr) {
  const dow = jakartaWeekday(dateStr);
  const schedule = await getWorkScheduleForDay(dow);
  const [[holiday]] = await aloraMobilePool.query(
    `SELECT holiday_date, name, holiday_type FROM mst_holiday WHERE holiday_date = ? LIMIT 1`,
    [dateStr]
  );
  return { schedule, holiday: holiday || null, dayOfWeek: dow };
}

export async function isHoliday(dateStr) {
  const [[row]] = await aloraMobilePool.query(
    `SELECT id FROM mst_holiday WHERE holiday_date = ? LIMIT 1`,
    [dateStr]
  );
  return Boolean(row);
}

export async function isOffDay(dateStr) {
  const { schedule, holiday } = await getWorkScheduleForDate(dateStr);
  if (holiday) return true;
  if (!schedule) return jakartaWeekday(dateStr) === 0;
  return Number(schedule.is_working_day) === 0;
}

function timeToParts(timeVal) {
  const str = String(timeVal || '08:30:00');
  const [h, m] = str.split(':');
  return { h: Number(h), m: Number(m) };
}

export async function getLateToleranceDateTime(dateStr) {
  const { schedule } = await getWorkScheduleForDate(dateStr);
  const tol = schedule?.late_tolerance_time || '08:30:00';
  const { h, m } = timeToParts(tol);
  const pad = (n) => String(n).padStart(2, '0');
  return new Date(`${dateStr}T${pad(h)}:${pad(m)}:00+07:00`);
}

export function computeLateMinutesFromClockIn(clockInDate, dateStr, toleranceDate) {
  if (!clockInDate || Number.isNaN(clockInDate.getTime())) return 0;
  const tol = toleranceDate || new Date(`${dateStr}T08:30:00+07:00`);
  const diffMs = clockInDate.getTime() - tol.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 60000);
}

export async function computeLateMinutes(clockIn, dateStr) {
  const tolerance = await getLateToleranceDateTime(dateStr);
  const clockDate = clockIn instanceof Date ? clockIn : new Date(clockIn);
  return computeLateMinutesFromClockIn(clockDate, dateStr, tolerance);
}

export function buildPeriodRange(month, year) {
  if (!(month >= 1 && month <= 12 && year >= 2000)) return null;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return {
    periodStart: `${prevYear}-${String(prevMonth).padStart(2, '0')}-26`,
    periodEnd: `${year}-${String(month).padStart(2, '0')}-25`,
  };
}
