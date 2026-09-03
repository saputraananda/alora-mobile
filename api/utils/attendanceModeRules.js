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
  return [ATTENDANCE_MODES.REGULAR, ATTENDANCE_MODES.WFA, ATTENDANCE_MODES.WOD];
}

export function assertModeAllowedForDay({ isOffDay, attendanceMode }) {
  const mode = String(attendanceMode || '').trim();
  if (![ATTENDANCE_MODES.REGULAR, ATTENDANCE_MODES.WFA, ATTENDANCE_MODES.WOD].includes(mode)) {
    const error = new Error('attendance_mode tidak valid');
    error.statusCode = 422;
    throw error;
  }
  // WOD diizinkan setiap hari. Di hari libur hanya WOD yang boleh.
  if (isOffDay && mode !== ATTENDANCE_MODES.WOD) {
    const error = new Error('Hari ini libur. Pilih Work on Day Off (WOD).');
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

export function durationHoursFromSeconds(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) {
    return { error: 'Durasi absensi tidak valid' };
  }
  if (n === 0) {
    return { durationHours: 0.01 };
  }
  return { durationHours: Math.round((n / 3600) * 100) / 100 };
}

function toJakartaEpochMs(value) {
  if (value == null) return NaN;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? NaN : t;
  }
  const raw = String(value).trim();
  if (!raw) return NaN;
  // MySQL DATETIME / TIMESTAMP string without offset → treat as WIB
  const normalized = raw.includes('T')
    ? raw
    : raw.replace(' ', 'T');
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    return new Date(normalized).getTime();
  }
  const withOffset = normalized.length === 10
    ? `${normalized}T00:00:00+07:00`
    : `${normalized}+07:00`;
  return new Date(withOffset).getTime();
}

export function computeDurationHours(clockIn, clockOut) {
  const start = toJakartaEpochMs(clockIn);
  const end = toJakartaEpochMs(clockOut);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
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
  'Hari ini libur. Absensi Harian/WFA tidak tersedia. Jika Anda bekerja, pilih Ini WOD — jam disetujui masuk saldo Replace Off.';
