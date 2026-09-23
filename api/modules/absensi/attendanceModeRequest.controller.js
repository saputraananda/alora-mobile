import { aloraMobilePool, mainPool } from '../../db/pool.js';
import {
  MODE_REQUEST_STATUSES,
  MODE_REQUEST_TYPES,
  canApproveModeRequests,
  statusLabel,
  toDateOnly,
  validateCreatePayload,
} from './utils/attendanceModeRequestRules.js';
import { appendReplaceOffLedger } from '../perizinan/utils/ledgerService.js';

async function getEmployeeJobContext(employeeId) {
  const [rows] = await mainPool.query(
    `SELECT employee_id, job_level_id, department_id, full_name
     FROM mst_employee
     WHERE employee_id = ? AND is_deleted = 0
     LIMIT 1`,
    [employeeId]
  );
  return rows[0] || null;
}

async function getEmployeeMap(employeeIds) {
  const uniqueIds = [...new Set(employeeIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (uniqueIds.length === 0) return new Map();
  const placeholders = uniqueIds.map(() => '?').join(',');
  const [rows] = await mainPool.query(
    `SELECT employee_id, full_name, department_id, job_level_id
     FROM mst_employee
     WHERE is_deleted = 0 AND employee_id IN (${placeholders})`,
    uniqueIds
  );
  const map = new Map();
  for (const row of rows) {
    map.set(Number(row.employee_id), row);
  }
  return map;
}

function serializeRow(row, extra = {}) {
  if (!row) return null;
  return {
    ...row,
    work_date: toDateOnly(row.work_date),
    status_label: statusLabel(row.status),
    ...extra,
  };
}

export async function getApprovedRequestForDate(employeeId, workDate) {
  const dateOnly = toDateOnly(workDate);
  if (!dateOnly) return null;
  const [[row]] = await aloraMobilePool.query(
    `SELECT * FROM tr_attendance_mode_requests
     WHERE employee_id = ? AND work_date = ? AND status = ?
     LIMIT 1`,
    [employeeId, dateOnly, MODE_REQUEST_STATUSES.APPROVED]
  );
  return row || null;
}

export async function assertNoActiveRequestConflict(employeeId, workDate) {
  const dateOnly = toDateOnly(workDate);
  const [rows] = await aloraMobilePool.query(
    `SELECT id, request_type, status FROM tr_attendance_mode_requests
     WHERE employee_id = ? AND work_date = ? AND status IN (?, ?)
     LIMIT 1`,
    [employeeId, dateOnly, MODE_REQUEST_STATUSES.PENDING, MODE_REQUEST_STATUSES.APPROVED]
  );
  if (rows[0]) {
    const error = new Error(
      `Sudah ada pengajuan ${String(rows[0].request_type).toUpperCase()} aktif untuk tanggal ini`
    );
    error.statusCode = 409;
    throw error;
  }
}

export async function applyWodLedgerFromAttendance(attendance) {
  if (!attendance || attendance.attendance_mode !== MODE_REQUEST_TYPES.WOD) return null;
  const hours = Number(attendance.duration_hours || 0);
  if (hours <= 0) return null;
  const attendanceId = attendance.id;
  const employeeId = attendance.employee_id;

  const [existing] = await aloraMobilePool.query(
    `SELECT id FROM tr_replace_off_ledger
     WHERE attendance_id = ? AND mutation_type = 'earned'
     LIMIT 1`,
    [attendanceId]
  );
  if (existing.length > 0) return null;

  return appendReplaceOffLedger({
    employeeId,
    attendanceId,
    mutationType: 'earned',
    hours,
    note: `WOD clock-out #${attendanceId}`,
  });
}

export const createRequest = async (req, res) => {
  try {
    const validated = validateCreatePayload(req.body);
    if (validated.error) {
      return res.status(422).json({ message: validated.error });
    }

    const requester = await getEmployeeJobContext(req.employeeId);
    if (!requester) {
      return res.status(400).json({ message: 'Data karyawan tidak ditemukan' });
    }

    await assertNoActiveRequestConflict(req.employeeId, validated.workDate);

    const [result] = await aloraMobilePool.query(
      `INSERT INTO tr_attendance_mode_requests
         (employee_id, request_type, work_date, reason, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.employeeId,
        validated.requestType,
        validated.workDate,
        validated.reason,
        MODE_REQUEST_STATUSES.PENDING,
      ]
    );

    const [[row]] = await aloraMobilePool.query(
      'SELECT * FROM tr_attendance_mode_requests WHERE id = ?',
      [result.insertId]
    );
    return res.status(201).json({ message: 'Pengajuan berhasil dikirim', item: serializeRow(row) });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error('[mode-request] create', error);
    return res.status(status).json({ message: error.message || 'Gagal membuat pengajuan' });
  }
};

export const listMine = async (req, res) => {
  try {
    const requestType = String(req.query.request_type || '').trim().toLowerCase();
    const month = parseInt(req.query.month || '0', 10);
    const year = parseInt(req.query.year || '0', 10);

    const where = ['employee_id = ?'];
    const params = [req.employeeId];

    if (requestType === MODE_REQUEST_TYPES.WFA || requestType === MODE_REQUEST_TYPES.WOD) {
      where.push('request_type = ?');
      params.push(requestType);
    }
    if (month >= 1 && month <= 12 && year >= 2000) {
      where.push('MONTH(work_date) = ? AND YEAR(work_date) = ?');
      params.push(month, year);
    }

    const [rows] = await aloraMobilePool.query(
      `SELECT * FROM tr_attendance_mode_requests
       WHERE ${where.join(' AND ')}
       ORDER BY work_date DESC, id DESC
       LIMIT 100`,
      params
    );
    return res.json({ items: rows.map((r) => serializeRow(r)) });
  } catch (error) {
    console.error('[mode-request] listMine', error);
    return res.status(500).json({ message: 'Gagal mengambil pengajuan' });
  }
};

export const cancelRequest = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'ID tidak valid' });
    }

    const [[row]] = await aloraMobilePool.query(
      'SELECT * FROM tr_attendance_mode_requests WHERE id = ? AND employee_id = ? LIMIT 1',
      [id, req.employeeId]
    );
    if (!row) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
    if (row.status !== MODE_REQUEST_STATUSES.PENDING) {
      return res.status(409).json({ message: 'Hanya pengajuan menunggu yang bisa dibatalkan' });
    }

    await aloraMobilePool.query('DELETE FROM tr_attendance_mode_requests WHERE id = ?', [id]);
    return res.json({ message: 'Pengajuan dibatalkan' });
  } catch (error) {
    console.error('[mode-request] cancel', error);
    return res.status(500).json({ message: 'Gagal membatalkan pengajuan' });
  }
};

export const listPendingApprovals = async (req, res) => {
  try {
    const approver = await getEmployeeJobContext(req.employeeId);
    if (!canApproveModeRequests(approver?.job_level_id)) {
      return res.status(403).json({ message: 'Hanya supervisor yang dapat melihat antrian' });
    }

    const requestType = String(req.query.request_type || '').trim().toLowerCase();
    const where = ['status = ?'];
    const params = [MODE_REQUEST_STATUSES.PENDING];
    if (requestType === MODE_REQUEST_TYPES.WFA || requestType === MODE_REQUEST_TYPES.WOD) {
      where.push('request_type = ?');
      params.push(requestType);
    }

    const [rows] = await aloraMobilePool.query(
      `SELECT * FROM tr_attendance_mode_requests
       WHERE ${where.join(' AND ')}
       ORDER BY created_at ASC
       LIMIT 200`,
      params
    );

    const empMap = await getEmployeeMap(rows.map((r) => r.employee_id));
    const deptId = approver.department_id != null ? Number(approver.department_id) : null;
    const filtered = rows.filter((row) => {
      if (Number(row.employee_id) === Number(req.employeeId)) return false;
      const emp = empMap.get(Number(row.employee_id));
      if (!emp) return false;
      if (deptId == null) return true;
      return Number(emp.department_id) === deptId;
    });

    return res.json({
      can_approve: true,
      items: filtered.map((r) => {
        const emp = empMap.get(Number(r.employee_id));
        return serializeRow(r, {
          employee_name: emp?.full_name || null,
        });
      }),
    });
  } catch (error) {
    console.error('[mode-request] pending', error);
    return res.status(500).json({ message: 'Gagal mengambil antrian approval' });
  }
};

export const getApproverCapability = async (req, res) => {
  try {
    const approver = await getEmployeeJobContext(req.employeeId);
    return res.json({
      can_approve: canApproveModeRequests(approver?.job_level_id),
    });
  } catch (error) {
    console.error('[mode-request] capability', error);
    return res.status(500).json({ message: 'Gagal cek kapabilitas approval' });
  }
};

export const approveRequest = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const approver = await getEmployeeJobContext(req.employeeId);
    if (!canApproveModeRequests(approver?.job_level_id)) {
      return res.status(403).json({ message: 'Hanya supervisor yang dapat menyetujui' });
    }

    const [[row]] = await aloraMobilePool.query(
      'SELECT * FROM tr_attendance_mode_requests WHERE id = ? LIMIT 1',
      [id]
    );
    if (!row) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
    if (Number(row.employee_id) === Number(req.employeeId)) {
      return res.status(403).json({ message: 'Tidak dapat menyetujui pengajuan sendiri' });
    }
    if (row.status !== MODE_REQUEST_STATUSES.PENDING) {
      return res.status(400).json({ message: 'Status pengajuan tidak valid untuk disetujui' });
    }

    const empMap = await getEmployeeMap([row.employee_id]);
    const emp = empMap.get(Number(row.employee_id));
    const deptId = approver.department_id != null ? Number(approver.department_id) : null;
    if (deptId != null && emp && Number(emp.department_id) !== deptId) {
      return res.status(403).json({ message: 'Pengajuan di luar departemen Anda' });
    }

    await aloraMobilePool.query(
      `UPDATE tr_attendance_mode_requests
       SET status = ?,
           supervisor_id = ?,
           supervisor_approved_at = NOW(),
           supervisor_rejection_reason = NULL,
           approved_by = ?,
           approved_by_name = ?,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [
        MODE_REQUEST_STATUSES.APPROVED,
        req.employeeId,
        req.employeeId,
        approver.full_name || null,
        id,
      ]
    );

    const [[updated]] = await aloraMobilePool.query(
      'SELECT * FROM tr_attendance_mode_requests WHERE id = ?',
      [id]
    );
    return res.json({ message: 'Pengajuan disetujui', item: serializeRow(updated) });
  } catch (error) {
    console.error('[mode-request] approve', error);
    return res.status(500).json({ message: 'Gagal menyetujui pengajuan' });
  }
};

export const rejectRequest = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 3) {
      return res.status(422).json({ message: 'Alasan penolakan wajib diisi' });
    }

    const approver = await getEmployeeJobContext(req.employeeId);
    if (!canApproveModeRequests(approver?.job_level_id)) {
      return res.status(403).json({ message: 'Hanya supervisor yang dapat menolak' });
    }

    const [[row]] = await aloraMobilePool.query(
      'SELECT * FROM tr_attendance_mode_requests WHERE id = ? LIMIT 1',
      [id]
    );
    if (!row) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
    if (Number(row.employee_id) === Number(req.employeeId)) {
      return res.status(403).json({ message: 'Tidak dapat menolak pengajuan sendiri' });
    }
    if (row.status !== MODE_REQUEST_STATUSES.PENDING) {
      return res.status(400).json({ message: 'Status pengajuan tidak valid untuk ditolak' });
    }

    const empMap = await getEmployeeMap([row.employee_id]);
    const emp = empMap.get(Number(row.employee_id));
    const deptId = approver.department_id != null ? Number(approver.department_id) : null;
    if (deptId != null && emp && Number(emp.department_id) !== deptId) {
      return res.status(403).json({ message: 'Pengajuan di luar departemen Anda' });
    }

    await aloraMobilePool.query(
      `UPDATE tr_attendance_mode_requests
       SET status = ?,
           supervisor_id = ?,
           supervisor_rejection_reason = ?,
           supervisor_approved_at = NULL,
           approved_by = NULL,
           approved_by_name = NULL,
           approved_at = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [MODE_REQUEST_STATUSES.REJECTED, req.employeeId, reason, id]
    );

    const [[updated]] = await aloraMobilePool.query(
      'SELECT * FROM tr_attendance_mode_requests WHERE id = ?',
      [id]
    );
    return res.json({ message: 'Pengajuan ditolak', item: serializeRow(updated) });
  } catch (error) {
    console.error('[mode-request] reject', error);
    return res.status(500).json({ message: 'Gagal menolak pengajuan' });
  }
};
