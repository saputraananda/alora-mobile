import { aloraMobilePool, mainPool } from '../db/pool.js';
import {
  ACTIVE_STATUSES,
  EDITABLE_STATUSES,
  buildPeriodRange,
  resolveInitialStatus,
  statusLabel,
  toDateOnly,
  validateLemburRoPayload,
} from '../utils/lemburRoRules.js';

async function getRequesterJobContext(employeeId) {
  const [rows] = await mainPool.query(
    `SELECT employee_id, job_level_id, department_id, full_name
     FROM mst_employee
     WHERE employee_id = ? AND is_deleted = 0
     LIMIT 1`,
    [employeeId]
  );
  return rows[0] || null;
}

function formatTimeFromDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
}

function serializeRow(row) {
  if (!row) return null;
  return {
    ...row,
    work_date: toDateOnly(row.work_date),
    replacement_date: row.replacement_date ? toDateOnly(row.replacement_date) : null,
    start_at: row.start_at ? new Date(row.start_at).toISOString() : null,
    end_at: row.end_at ? new Date(row.end_at).toISOString() : null,
    start_time: formatTimeFromDate(row.start_at),
    end_time: formatTimeFromDate(row.end_at),
    duration_hours: row.duration_hours != null ? Number(row.duration_hours) : null,
    status_label: statusLabel(row.status),
  };
}

export const listRequests = async (req, res) => {
  const employeeId = req.employeeId;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const offset = (page - 1) * limit;
  const month = parseInt(req.query.month || '0', 10);
  const year = parseInt(req.query.year || '0', 10);
  const requestType = String(req.query.request_type || '').trim();

  try {
    let periodWhere = '';
    const periodParams = [];
    const period = buildPeriodRange(month, year);
    if (period) {
      periodWhere = ' AND work_date >= ? AND work_date <= ?';
      periodParams.push(period.periodStart, period.periodEnd);
    }

    let typeWhere = '';
    const typeParams = [];
    if (requestType === 'lembur' || requestType === 'replace_off') {
      typeWhere = ' AND request_type = ?';
      typeParams.push(requestType);
    }

    const [[{ total }]] = await aloraMobilePool.query(
      `SELECT COUNT(*) AS total FROM tr_worker_lembur_ro
       WHERE employee_id = ?${periodWhere}${typeWhere}`,
      [employeeId, ...periodParams, ...typeParams]
    );

    const [rows] = await aloraMobilePool.query(
      `SELECT id, employee_id, request_type, work_date, start_at, end_at, duration_hours,
              description, compensation_type, replacement_date, status,
              department_id, supervisor_id, supervisor_approved_at, supervisor_rejection_reason,
              hrd_id, hrd_approved_at, hrd_rejection_reason, rejection_note,
              approved_by, approved_by_name, approved_at, created_at, updated_at
       FROM tr_worker_lembur_ro
       WHERE employee_id = ?${periodWhere}${typeWhere}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [employeeId, ...periodParams, ...typeParams, limit, offset]
    );

    return res.json({
      total: Number(total) || 0,
      page,
      limit,
      items: rows.map(serializeRow),
    });
  } catch (error) {
    console.error('[lemburRo] listRequests', error);
    return res.status(500).json({ message: 'Gagal mengambil riwayat pengajuan' });
  }
};

export const getStats = async (req, res) => {
  const employeeId = req.employeeId;
  const month = parseInt(req.query.month || '0', 10);
  const year = parseInt(req.query.year || '0', 10);

  try {
    let whereClause = 'WHERE employee_id = ?';
    const params = [employeeId];
    const period = buildPeriodRange(month, year);
    if (period) {
      whereClause += ' AND work_date >= ? AND work_date <= ?';
      params.push(period.periodStart, period.periodEnd);
    }

    const [rows] = await aloraMobilePool.query(
      `SELECT request_type, status, COUNT(*) AS cnt
       FROM tr_worker_lembur_ro ${whereClause}
       GROUP BY request_type, status`,
      params
    );

    const stats = {
      lembur: 0,
      replace_off: 0,
      pending: 0,
    };
    rows.forEach((r) => {
      if (r.request_type === 'lembur') stats.lembur += Number(r.cnt) || 0;
      if (r.request_type === 'replace_off') stats.replace_off += Number(r.cnt) || 0;
      if (r.status === 'Pending_Supervisor' || r.status === 'Pending_HRD') {
        stats.pending += Number(r.cnt) || 0;
      }
    });

    return res.json({ stats });
  } catch (error) {
    console.error('[lemburRo] getStats', error);
    return res.status(500).json({ message: 'Gagal mengambil statistik' });
  }
};

export const createRequest = async (req, res) => {
  const employeeId = req.employeeId;

  try {
    const validated = validateLemburRoPayload(req.body);
    if (validated.error) {
      return res.status(422).json({ message: validated.error });
    }

    const requester = await getRequesterJobContext(employeeId);
    if (!requester) {
      return res.status(403).json({ message: 'Data karyawan tidak ditemukan' });
    }

    const initialStatus = resolveInitialStatus(requester.job_level_id);
    const departmentId = requester.department_id != null ? Number(requester.department_id) : null;

    const [overlap] = await aloraMobilePool.query(
      `SELECT id FROM tr_worker_lembur_ro
       WHERE employee_id = ?
         AND status IN (?, ?, ?)
         AND work_date = ?
         AND request_type = ?`,
      [employeeId, ...ACTIVE_STATUSES, validated.workDate, validated.requestType]
    );
    if (overlap.length > 0) {
      return res.status(409).json({
        message: 'Anda sudah memiliki pengajuan aktif pada tanggal dan jenis yang sama',
      });
    }

    const [result] = await aloraMobilePool.query(
      `INSERT INTO tr_worker_lembur_ro
         (employee_id, request_type, work_date, start_at, end_at, duration_hours,
          description, compensation_type, replacement_date, status, department_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employeeId,
        validated.requestType,
        validated.workDate,
        validated.startAt,
        validated.endAt,
        validated.durationHours,
        validated.description,
        validated.compensationType,
        validated.replacementDate,
        initialStatus,
        departmentId,
      ]
    );

    const [[inserted]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_lembur_ro WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json({
      message: 'Pengajuan berhasil dikirim',
      item: serializeRow(inserted),
    });
  } catch (error) {
    console.error('[lemburRo] createRequest', error);
    return res.status(500).json({ message: 'Gagal mengirim pengajuan' });
  }
};

export const updateRequest = async (req, res) => {
  const employeeId = req.employeeId;
  const id = Number(req.params.id);

  try {
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'ID tidak valid' });
    }

    const [[existing]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_lembur_ro WHERE id = ? AND employee_id = ?',
      [id, employeeId]
    );
    if (!existing) {
      return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      return res.status(403).json({ message: 'Pengajuan yang sudah diproses tidak dapat diubah' });
    }

    const payload = {
      request_type: req.body.request_type || existing.request_type,
      work_date: req.body.work_date || toDateOnly(existing.work_date),
      start_time: req.body.start_time || formatTimeFromDate(existing.start_at),
      end_time: req.body.end_time || formatTimeFromDate(existing.end_at),
      description: req.body.description != null ? req.body.description : existing.description,
      compensation_type: req.body.compensation_type !== undefined
        ? req.body.compensation_type
        : existing.compensation_type,
      replacement_date: req.body.replacement_date !== undefined
        ? req.body.replacement_date
        : existing.replacement_date,
    };

    const validated = validateLemburRoPayload(payload);
    if (validated.error) {
      return res.status(422).json({ message: validated.error });
    }

    const requester = await getRequesterJobContext(employeeId);
    if (!requester) {
      return res.status(403).json({ message: 'Data karyawan tidak ditemukan' });
    }

    const initialStatus = resolveInitialStatus(requester.job_level_id);
    const departmentId = requester.department_id != null ? Number(requester.department_id) : null;

    const [overlap] = await aloraMobilePool.query(
      `SELECT id FROM tr_worker_lembur_ro
       WHERE employee_id = ? AND id <> ?
         AND status IN (?, ?, ?)
         AND work_date = ?
         AND request_type = ?`,
      [employeeId, id, ...ACTIVE_STATUSES, validated.workDate, validated.requestType]
    );
    if (overlap.length > 0) {
      return res.status(409).json({
        message: 'Terdapat pengajuan aktif lain pada tanggal dan jenis yang sama',
      });
    }

    await aloraMobilePool.query(
      `UPDATE tr_worker_lembur_ro
       SET request_type = ?, work_date = ?, start_at = ?, end_at = ?, duration_hours = ?,
           description = ?, compensation_type = ?, replacement_date = ?,
           status = ?, department_id = ?,
           supervisor_id = NULL, supervisor_approved_at = NULL, supervisor_rejection_reason = NULL,
           hrd_id = NULL, hrd_approved_at = NULL, hrd_rejection_reason = NULL,
           rejection_note = NULL, approved_by = NULL, approved_by_name = NULL, approved_at = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [
        validated.requestType,
        validated.workDate,
        validated.startAt,
        validated.endAt,
        validated.durationHours,
        validated.description,
        validated.compensationType,
        validated.replacementDate,
        initialStatus,
        departmentId,
        id,
      ]
    );

    const [[updated]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_lembur_ro WHERE id = ?',
      [id]
    );

    return res.json({
      message: 'Pengajuan berhasil diperbarui',
      item: serializeRow(updated),
    });
  } catch (error) {
    console.error('[lemburRo] updateRequest', error);
    return res.status(500).json({ message: 'Gagal memperbarui pengajuan' });
  }
};

export const cancelRequest = async (req, res) => {
  const employeeId = req.employeeId;
  const id = Number(req.params.id);

  try {
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'ID tidak valid' });
    }

    const [[existing]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_lembur_ro WHERE id = ? AND employee_id = ?',
      [id, employeeId]
    );
    if (!existing) {
      return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      return res.status(403).json({
        message: 'Hanya pengajuan menunggu supervisor atau ditolak yang dapat dibatalkan',
      });
    }

    await aloraMobilePool.query('DELETE FROM tr_worker_lembur_ro WHERE id = ?', [id]);
    return res.json({ message: 'Pengajuan berhasil dibatalkan' });
  } catch (error) {
    console.error('[lemburRo] cancelRequest', error);
    return res.status(500).json({ message: 'Gagal membatalkan pengajuan' });
  }
};
