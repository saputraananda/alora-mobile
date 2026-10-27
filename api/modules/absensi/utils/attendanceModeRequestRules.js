import { toDateOnlyJakarta } from '../../../shared/utils/workScheduleRules.js';

export const MODE_REQUEST_TYPES = {
  WFA: 'wfa',
  WOD: 'wod',
};

export const MODE_REQUEST_STATUSES = {
  PENDING: 'Pending_Supervisor',
  PENDING_SUPERVISOR: 'Pending_Supervisor',
  PENDING_HRD: 'Pending_HRD',
  APPROVED: 'disetujui',
  REJECTED: 'Rejected_Supervisor',
  REJECTED_SUPERVISOR: 'Rejected_Supervisor',
  REJECTED_HRD: 'Rejected_HRD',
};

export const ACTIVE_MODE_REQUEST_STATUSES = [
  MODE_REQUEST_STATUSES.PENDING_SUPERVISOR,
  MODE_REQUEST_STATUSES.PENDING_HRD,
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

export function resolveInitialStatus(jobLevelId) {
  const level = Number(jobLevelId);
  if (!Number.isInteger(level) || level === 4 || level > 4 || level < 1) {
    return MODE_REQUEST_STATUSES.PENDING_SUPERVISOR;
  }
  if (level <= 3) return MODE_REQUEST_STATUSES.PENDING_HRD;
  return MODE_REQUEST_STATUSES.PENDING_SUPERVISOR;
}

export function statusLabel(status) {
  if (status === MODE_REQUEST_STATUSES.APPROVED) return 'Disetujui';
  if (status === MODE_REQUEST_STATUSES.REJECTED_SUPERVISOR) return 'Ditolak Supervisor';
  if (status === MODE_REQUEST_STATUSES.REJECTED_HRD) return 'Ditolak HRD';
  if (status === MODE_REQUEST_STATUSES.PENDING_SUPERVISOR) return 'Menunggu Supervisor';
  if (status === MODE_REQUEST_STATUSES.PENDING_HRD) return 'Menunggu HRD';
  return status || 'Status';
}

export function canApproveModeRequests(jobLevelId, positionId) {
  const level = Number(jobLevelId);
  const isSpv = Number.isInteger(level) && level > 0 && level <= 3;
  const HRD_POSITION_IDS = [1, 8, 17, 18, 19];
  const isHrd = HRD_POSITION_IDS.includes(Number(positionId));
  return isSpv || isHrd;
}
