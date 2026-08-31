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
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
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

export function validateLemburRoPayload(payload) {
  const requestType = String(payload.request_type || '').trim();
  const workDate = toDateOnly(payload.work_date);
  const description = String(payload.description || '').trim();
  const compensationType = payload.compensation_type
    ? String(payload.compensation_type).trim()
    : null;
  const replacementDate = payload.replacement_date
    ? toDateOnly(payload.replacement_date)
    : null;

  if (!Object.values(REQUEST_TYPES).includes(requestType)) {
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

  if (requestType === REQUEST_TYPES.LEMBUR) {
    return {
      requestType,
      workDate,
      description,
      compensationType: null,
      replacementDate: null,
      ...durationResult,
    };
  }

  if (jakartaWeekday(workDate) === 0) {
    return { error: 'Hari Minggu libur, tidak dapat diajukan RO' };
  }

  const weekday = jakartaWeekday(workDate);
  if (weekday === 6 && durationResult.durationHours < 5) {
    return { error: 'RO hari Sabtu minimal 5 jam kerja' };
  }
  if (weekday >= 1 && weekday <= 5 && durationResult.durationHours < 8) {
    return { error: 'RO Senin–Jumat minimal 8 jam kerja' };
  }

  if (![COMPENSATION.GANTI_HARI, COMPENSATION.KOMPENSASI_TUNAI].includes(compensationType)) {
    return { error: 'Tipe kompensasi RO wajib dipilih' };
  }

  if (compensationType === COMPENSATION.GANTI_HARI) {
    if (!replacementDate) {
      return { error: 'Tanggal hari pengganti wajib diisi' };
    }
    if (jakartaWeekday(replacementDate) === 0) {
      return { error: 'Hari pengganti tidak boleh hari Minggu' };
    }
  } else if (replacementDate) {
    return { error: 'Kompensasi tunai tidak memerlukan hari pengganti' };
  }

  return {
    requestType,
    workDate,
    description,
    compensationType,
    replacementDate: compensationType === COMPENSATION.GANTI_HARI ? replacementDate : null,
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
