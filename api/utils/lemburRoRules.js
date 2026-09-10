import { toDateOnlyJakarta } from './workScheduleRules.js';

export const REQUEST_TYPES = {
  LEMBUR: 'lembur',
  REPLACE_OFF: 'replace_off',
};

export const COMPENSATION = {
  GANTI_HARI: 'ganti_hari',
  KOMPENSASI_TUNAI: 'kompensasi_tunai',
};

export const PENDING_STATUSES = ['Pending_Supervisor', 'Pending_HRD'];
export const EDITABLE_STATUSES = ['Pending_Supervisor', 'Rejected_Supervisor', 'Rejected_HRD'];
export const ACTIVE_STATUSES = ['Pending_Supervisor', 'Pending_HRD', 'disetujui'];

export function resolveInitialStatus(jobLevelId) {
  const level = Number(jobLevelId);
  if (!Number.isInteger(level) || level === 4 || level > 4 || level < 1) {
    return 'Pending_Supervisor';
  }
  if (level <= 3) return 'Pending_HRD';
  return 'Pending_Supervisor';
}

export function toDateOnly(value) {
  return toDateOnlyJakarta(value);
}

export function jakartaWeekday(dateStr) {
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  return d.getUTCDay();
}

function parseTimeParts(timeStr) {
  const m = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min };
}

export function computeDurationHours(workDate, startTime, endTime) {
  const startParts = parseTimeParts(startTime);
  const endParts = parseTimeParts(endTime);
  if (!startParts || !endParts || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return { error: 'Format tanggal atau waktu tidak valid' };
  }

  const pad = (n) => String(n).padStart(2, '0');
  const startAt = new Date(`${workDate}T${pad(startParts.h)}:${pad(startParts.min)}:00+07:00`);
  const endAt = new Date(`${workDate}T${pad(endParts.h)}:${pad(endParts.min)}:00+07:00`);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return { error: 'Format tanggal atau waktu tidak valid' };
  }
  if (endAt <= startAt) {
    return { error: 'Jam selesai harus setelah jam mulai' };
  }

  const hours = Math.round(((endAt - startAt) / 3600000) * 100) / 100;
  return { startAt, endAt, durationHours: hours };
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
  if (items == null) {
    return { error: 'To-do list wajib diisi untuk pengajuan lembur' };
  }
  if (!Array.isArray(items)) {
    return { error: 'To-do list harus berupa array' };
  }
  const cleaned = items
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (cleaned.length < 1) {
    return { error: 'Minimal 1 poin pekerjaan wajib diisi untuk lembur' };
  }
  if (cleaned.length > 20) {
    return { error: 'Maksimal 20 poin pekerjaan' };
  }
  return { items: cleaned };
}

export function validateLemburRoPayload(payload) {
  const requestType = String(payload.request_type || '').trim() || REQUEST_TYPES.LEMBUR;
  const workDate = toDateOnly(payload.work_date);
  const description = String(payload.description || '').trim();

  if (requestType === REQUEST_TYPES.REPLACE_OFF) {
    return { error: 'Pengajuan RO tidak tersedia di modul ini. Gunakan Perizinan.' };
  }
  if (requestType !== REQUEST_TYPES.LEMBUR) {
    return { error: 'Jenis pengajuan tidak valid' };
  }
  if (!workDate) {
    return { error: 'Tanggal kerja wajib diisi' };
  }
  if (!description || description.length < 5) {
    return { error: 'Keterangan wajib diisi minimal 5 karakter' };
  }

  const durationResult = computeDurationHours(workDate, payload.start_time, payload.end_time);
  if (durationResult.error) {
    return { error: durationResult.error };
  }

  const todoResult = validateTodoItems(payload.todo_items);
  if (todoResult.error) {
    return { error: todoResult.error };
  }

  return {
    requestType: REQUEST_TYPES.LEMBUR,
    workDate,
    description,
    todoItems: todoResult.items,
    compensationType: null,
    replacementDate: null,
    ...durationResult,
  };
}

export function statusLabel(status) {
  if (status === 'disetujui') return 'Disetujui';
  if (status === 'Rejected_Supervisor' || status === 'Rejected_HRD') return 'Ditolak';
  if (PENDING_STATUSES.includes(status)) return 'Menunggu Approval';
  return status || 'Status';
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
