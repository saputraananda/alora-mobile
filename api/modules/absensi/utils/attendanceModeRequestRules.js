import { toDateOnlyJakarta } from '../../../shared/utils/workScheduleRules.js';

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
  return toDateOnlyJakarta(value);
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
