export const ATTENDANCE_MODES = {
  REGULAR: 'regular',
  WFA: 'wfa',
  WOD: 'wod',
};

const MODES_REQUIRING_REASON = new Set([ATTENDANCE_MODES.WFA, ATTENDANCE_MODES.WOD]);

export function derivePunchLocationContext(insideRadius) {
  return insideRadius ? 'office' : 'remote';
}

export function resolveSuggestedMode({ isOffDay, insideRadius }) {
  if (isOffDay) return ATTENDANCE_MODES.WOD;
  if (insideRadius) return ATTENDANCE_MODES.REGULAR;
  return ATTENDANCE_MODES.WFA;
}

export function getAllowedModes(isOffDay) {
  if (isOffDay) return [ATTENDANCE_MODES.WOD];
  return [ATTENDANCE_MODES.REGULAR, ATTENDANCE_MODES.WFA];
}

export function assertModeAllowedForDay({ isOffDay, attendanceMode }) {
  const mode = String(attendanceMode || '').trim();
  if (isOffDay && mode !== ATTENDANCE_MODES.WOD) {
    const error = new Error('Hari ini libur. Pilih Work on Day Off (WOD).');
    error.statusCode = 422;
    throw error;
  }
  if (!isOffDay && mode === ATTENDANCE_MODES.WOD) {
    const error = new Error('WOD hanya untuk hari libur.');
    error.statusCode = 422;
    throw error;
  }
  if (![ATTENDANCE_MODES.REGULAR, ATTENDANCE_MODES.WFA, ATTENDANCE_MODES.WOD].includes(mode)) {
    const error = new Error('attendance_mode tidak valid');
    error.statusCode = 422;
    throw error;
  }
}

export function assertModeReasonRequired(attendanceMode, reason) {
  if (!MODES_REQUIRING_REASON.has(attendanceMode)) return;
  const trimmed = String(reason || '').trim();
  if (trimmed.length < 5) {
    const error = new Error('Alasan WFA/WOD wajib diisi minimal 5 karakter');
    error.statusCode = 422;
    throw error;
  }
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
  const cleaned = items.map((item) => String(item || '').trim()).filter(Boolean);
  if (cleaned.length < 1) {
    return { error: 'Minimal 1 poin pekerjaan wajib diisi sebelum clock out WOD' };
  }
  if (cleaned.length > 20) {
    return { error: 'Maksimal 20 poin pekerjaan' };
  }
  return { items: cleaned };
}

export function computeDurationHours(clockIn, clockOut) {
  const start = clockIn instanceof Date ? clockIn : new Date(clockIn);
  const end = clockOut instanceof Date ? clockOut : new Date(clockOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { error: 'Durasi absensi tidak valid' };
  }
  const hours = Math.round(((end - start) / 3600000) * 100) / 100;
  return { durationHours: hours };
}

export function formatModeLocationLabel({ attendanceMode, punchLocationContextIn }) {
  const mode = attendanceMode || ATTENDANCE_MODES.REGULAR;
  const ctx = punchLocationContextIn || 'remote';
  if (mode === ATTENDANCE_MODES.WFA) return 'WFA';
  if (mode === ATTENDANCE_MODES.WOD) {
    return ctx === 'office' ? 'WOD Office' : 'WOD Remote';
  }
  return 'Harian';
}

export function approvalStatusLabel(status) {
  if (status === 'Pending_Supervisor') return 'Menunggu Supervisor';
  if (status === 'disetujui') return 'Disetujui';
  if (status === 'Rejected_Supervisor') return 'Ditolak Supervisor';
  return status || null;
}

export const OFF_DAY_MESSAGE =
  'Hari ini libur. Jika Anda bekerja, pilih WOD — jam disetujui masuk saldo Replace Off.';
