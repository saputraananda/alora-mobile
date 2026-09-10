export const MODE_REQUEST_TYPES = {
  WFA: 'wfa',
  WOD: 'wod',
};

export const MODE_REQUEST_STATUSES = {
  PENDING: 'Pending_Supervisor',
  APPROVED: 'disetujui',
  REJECTED: 'Rejected_Supervisor',
};

export const ACTIVE_MODE_REQUEST_STATUSES = [
  MODE_REQUEST_STATUSES.PENDING,
  MODE_REQUEST_STATUSES.APPROVED,
];

export function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export function validateCreatePayload(payload) {
  const requestType = String(payload.request_type || '').trim().toLowerCase();
  const workDate = toDateOnly(payload.work_date);
  const reason = String(payload.reason || '').trim();

  if (requestType !== MODE_REQUEST_TYPES.WFA && requestType !== MODE_REQUEST_TYPES.WOD) {
    return { error: 'Jenis pengajuan harus wfa atau wod' };
  }
  if (!workDate) {
    return { error: 'Tanggal kerja wajib diisi' };
  }
  if (reason.length < 5) {
    return { error: 'Alasan wajib diisi minimal 5 karakter' };
  }

  return { requestType, workDate, reason };
}

export function statusLabel(status) {
  if (status === MODE_REQUEST_STATUSES.APPROVED) return 'Disetujui';
  if (status === MODE_REQUEST_STATUSES.REJECTED) return 'Ditolak';
  if (status === MODE_REQUEST_STATUSES.PENDING) return 'Menunggu Approval';
  return status || 'Status';
}

export function canApproveModeRequests(jobLevelId) {
  const level = Number(jobLevelId);
  return Number.isInteger(level) && level > 0 && level <= 3;
}
