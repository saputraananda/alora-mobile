import { aloraMobilePool } from '../db/pool.js';
import { isOffDay, todayDateStringJakarta } from './workScheduleRules.js';

export const SESSION_TYPES = {
  LEMBUR: 'lembur',
  EARNED_RO: 'earned_replace_off',
};

export function resolveSessionFinalStatus(jobLevelId, sessionType) {
  const level = Number(jobLevelId);
  if (sessionType === SESSION_TYPES.LEMBUR) {
    if (Number.isInteger(level) && level >= 1 && level <= 3) {
      return 'disetujui';
    }
    return 'Pending_Supervisor';
  }
  if (sessionType === SESSION_TYPES.EARNED_RO) {
    return 'Pending_Supervisor';
  }
  return 'Pending_Supervisor';
}

export function validateTodoItems(raw) {
  let items = raw;
  if (typeof raw === 'string') {
    try {
      items = JSON.parse(raw);
    } catch {
      return { error: 'Format to-do list tidak valid' };
    }
  }
  if (!Array.isArray(items)) {
    return { error: 'To-do list harus berupa array' };
  }
  const cleaned = items
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (cleaned.length < 1) {
    return { error: 'Minimal 1 poin pekerjaan wajib diisi sebelum clock out' };
  }
  if (cleaned.length > 20) {
    return { error: 'Maksimal 20 poin pekerjaan' };
  }
  return { items: cleaned };
}

export function computeSessionDurationHours(clockIn, clockOut) {
  const start = clockIn instanceof Date ? clockIn : new Date(clockIn);
  const end = clockOut instanceof Date ? clockOut : new Date(clockOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { error: 'Durasi sesi tidak valid' };
  }
  const hours = Math.round(((end - start) / 3600000) * 100) / 100;
  return { durationHours: hours };
}

export async function assertCanStartLembur(employeeId, workDate) {
  const off = await isOffDay(workDate);
  if (off) {
    const error = new Error('Lembur di hari libur — gunakan Earned Replace Off');
    error.statusCode = 400;
    throw error;
  }

  const [[attendance]] = await aloraMobilePool.query(
    `SELECT clock_in, clock_out FROM tr_worker_attendance
     WHERE employee_id = ? AND attendance_date = ? LIMIT 1`,
    [employeeId, workDate]
  );
  if (!attendance?.clock_out) {
    const error = new Error('Selesaikan absen keluar reguler terlebih dahulu sebelum clock in lembur');
    error.statusCode = 409;
    throw error;
  }
}

export async function assertCanStartEarnedRo(workDate) {
  const off = await isOffDay(workDate);
  if (!off) {
    const error = new Error('Earned Replace Off hanya untuk hari libur / tanggal merah');
    error.statusCode = 400;
    throw error;
  }
}

export async function assertNoActiveSession(employeeId, workDate = todayDateStringJakarta()) {
  const [[row]] = await aloraMobilePool.query(
    `SELECT id FROM tr_attendance_sessions
     WHERE employee_id = ? AND work_date = ? AND status = 'in_progress' LIMIT 1`,
    [employeeId, workDate]
  );
  if (row) {
    const error = new Error('Masih ada sesi kerja yang belum selesai (clock out)');
    error.statusCode = 409;
    throw error;
  }
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

export function sessionStatusLabel(status) {
  if (status === 'in_progress') return 'Sedang Berjalan';
  if (status === 'Pending_Supervisor' || status === 'Pending_HRD') return 'Menunggu Approval';
  if (status === 'disetujui') return 'Disetujui';
  if (status === 'Rejected_Supervisor' || status === 'Rejected_HRD') return 'Ditolak';
  return status;
}
