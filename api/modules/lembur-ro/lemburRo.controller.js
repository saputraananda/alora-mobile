import { aloraMobilePool, mainPool } from '../../db/pool.js';
import { getApproverContext } from '../../shared/utils/approvalAccess.js';
import {
  ACTIVE_STATUSES,
  EDITABLE_STATUSES,
  buildPeriodRange,
  resolveInitialStatus,
  statusLabel,
  toDateOnly,
  validateLemburRoPayload,
} from './lemburRoRules.js';

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

function parseTodoItems(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
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
    todo_items: parseTodoItems(row.todo_items),
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

  try {
    let periodWhere = '';
    const periodParams = [];
    const period = buildPeriodRange(month, year);
    if (period) {
      periodWhere = ' AND work_date >= ? AND work_date <= ?';
      periodParams.push(period.periodStart, period.periodEnd);
    }

    const typeWhere = " AND request_type = 'lembur'";

    const [[{ total }]] = await aloraMobilePool.query(
      `SELECT COUNT(*) AS total FROM tr_worker_lembur_ro
       WHERE employee_id = ?${periodWhere}${typeWhere}`,
      [employeeId, ...periodParams]
    );

    const [rows] = await aloraMobilePool.query(
      `SELECT id, employee_id, request_type, work_date, start_at, end_at, duration_hours,
              description, todo_items, compensation_type, replacement_date, status,
              department_id, supervisor_id, supervisor_approved_at, supervisor_rejection_reason,
              hrd_id, hrd_approved_at, hrd_rejection_reason, rejection_note,
              approved_by, approved_by_name, approved_at, created_at, updated_at
       FROM tr_worker_lembur_ro
       WHERE employee_id = ?${periodWhere}${typeWhere}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [employeeId, ...periodParams, limit, offset]
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
    let whereClause = "WHERE employee_id = ? AND request_type = 'lembur'";
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
      pending: 0,
    };
    rows.forEach((r) => {
      if (r.request_type === 'lembur') stats.lembur += Number(r.cnt) || 0;
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
    const todoJson = validated.todoItems ? JSON.stringify(validated.todoItems) : null;

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
          description, todo_items, compensation_type, replacement_date, status, department_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employeeId,
        validated.requestType,
        validated.workDate,
        validated.startAt,
        validated.endAt,
        validated.durationHours,
        validated.description,
        todoJson,
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

    const existingTodos = parseTodoItems(existing.todo_items);
    const payload = {
      request_type: req.body.request_type || existing.request_type,
      work_date: req.body.work_date || toDateOnly(existing.work_date),
      start_time: req.body.start_time || formatTimeFromDate(existing.start_at),
      end_time: req.body.end_time || formatTimeFromDate(existing.end_at),
      description: req.body.description != null ? req.body.description : existing.description,
      todo_items: req.body.todo_items !== undefined ? req.body.todo_items : existingTodos,
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
    const todoJson = validated.todoItems ? JSON.stringify(validated.todoItems) : null;

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
           description = ?, todo_items = ?, compensation_type = ?, replacement_date = ?,
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
        todoJson,
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

async function getEmployeeNameMap(employeeIds) {
  const uniqueIds = [...new Set(employeeIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (uniqueIds.length === 0) return new Map();
  const placeholders = uniqueIds.map(() => '?').join(',');
  const [rows] = await mainPool.query(
    `SELECT employee_id, full_name FROM mst_employee
     WHERE is_deleted = 0 AND employee_id IN (${placeholders})`,
    uniqueIds
  );
  const map = new Map();
  for (const row of rows) {
    map.set(Number(row.employee_id), row.full_name || null);
  }
  return map;
}

export const listPendingApprovals = async (req, res) => {
  try {
    const ctx = await getApproverContext(req.employeeId);
    if (!ctx?.canAccess) {
      return res.status(403).json({ message: 'Hanya SPV atau HRD yang dapat melihat antrian' });
    }

    const where = [];
    const params = [];

    if (ctx.isSpv && ctx.isHrd) {
      where.push(`(status = 'Pending_Supervisor' OR status = 'Pending_HRD')`);
    } else if (ctx.isSpv) {
      where.push(`status = 'Pending_Supervisor'`);
    } else {
      where.push(`status = 'Pending_HRD'`);
    }

    if (ctx.isSpv && !ctx.isHrd && ctx.departmentId != null) {
      where.push('department_id = ?');
      params.push(ctx.departmentId);
    } else if (ctx.isSpv && ctx.isHrd && ctx.departmentId != null) {
      where.push(`(
        (status = 'Pending_HRD')
        OR (status = 'Pending_Supervisor' AND department_id = ?)
      )`);
      params.push(ctx.departmentId);
    }

    const [rows] = await aloraMobilePool.query(
      `SELECT * FROM tr_worker_lembur_ro
       WHERE ${where.join(' AND ')}
       ORDER BY created_at ASC
       LIMIT 200`,
      params
    );

    const filtered = rows.filter((row) => {
      if (Number(row.employee_id) === Number(req.employeeId)) return false;
      if (row.status === 'Pending_Supervisor' && ctx.isSpv) {
        if (ctx.departmentId != null && Number(row.department_id) !== ctx.departmentId) return false;
        return true;
      }
      if (row.status === 'Pending_HRD' && ctx.isHrd) return true;
      return false;
    });

    const nameMap = await getEmployeeNameMap(filtered.map((r) => r.employee_id));
    return res.json({
      can_approve: true,
      items: filtered.map((row) => ({
        ...serializeRow(row),
        employee_name: nameMap.get(Number(row.employee_id)) || null,
        action_role: row.status === 'Pending_HRD' ? 'hrd' : 'spv',
      })),
    });
  } catch (error) {
    console.error('[lemburRo] listPendingApprovals', error);
    return res.status(500).json({ message: 'Gagal mengambil antrian approval lembur' });
  }
};

export const approveSupervisor = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'ID tidak valid' });
    }

    const ctx = await getApproverContext(req.employeeId);
    if (!ctx?.isSpv) {
      return res.status(403).json({ message: 'Hanya supervisor yang dapat memberikan persetujuan' });
    }

    const [[item]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_lembur_ro WHERE id = ? LIMIT 1',
      [id]
    );
    if (!item) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
    if (Number(item.employee_id) === Number(req.employeeId)) {
      return res.status(403).json({ message: 'Tidak dapat menyetujui pengajuan sendiri' });
    }
    if (item.status !== 'Pending_Supervisor') {
      return res.status(400).json({ message: 'Status pengajuan tidak valid untuk persetujuan supervisor' });
    }
    if (ctx.departmentId != null && Number(item.department_id) !== ctx.departmentId) {
      return res.status(403).json({ message: 'Anda hanya dapat menyetujui pengajuan dari departemen Anda sendiri' });
    }

    await aloraMobilePool.query(
      `UPDATE tr_worker_lembur_ro SET
        status = 'disetujui',
        supervisor_id = ?,
        supervisor_approved_at = NOW(),
        supervisor_rejection_reason = NULL,
        approved_by = ?,
        approved_by_name = ?,
        approved_at = NOW(),
        updated_at = NOW()
       WHERE id = ?`,
      [req.employeeId, req.employeeId, ctx.fullName, id]
    );
    return res.json({ message: 'Pengajuan lembur berhasil disetujui.' });
  } catch (error) {
    console.error('[lemburRo] approveSupervisor', error);
    return res.status(500).json({ message: 'Gagal melakukan approval supervisor' });
  }
};

export const rejectSupervisor = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reason = String(req.body?.reason || '').trim().slice(0, 1000);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'ID tidak valid' });
    }
    if (!reason) {
      return res.status(400).json({ message: 'Alasan penolakan wajib diisi' });
    }

    const ctx = await getApproverContext(req.employeeId);
    if (!ctx?.isSpv) {
      return res.status(403).json({ message: 'Hanya supervisor yang dapat menolak pengajuan' });
    }

    const [[item]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_lembur_ro WHERE id = ? LIMIT 1',
      [id]
    );
    if (!item) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
    if (Number(item.employee_id) === Number(req.employeeId)) {
      return res.status(403).json({ message: 'Tidak dapat menolak pengajuan sendiri' });
    }
    if (item.status !== 'Pending_Supervisor') {
      return res.status(400).json({ message: 'Status pengajuan tidak valid untuk ditolak oleh supervisor' });
    }
    if (ctx.departmentId != null && Number(item.department_id) !== ctx.departmentId) {
      return res.status(403).json({ message: 'Anda hanya dapat menolak pengajuan dari departemen Anda sendiri' });
    }

    await aloraMobilePool.query(
      `UPDATE tr_worker_lembur_ro SET
        status = 'Rejected_Supervisor',
        supervisor_id = ?,
        supervisor_rejection_reason = ?,
        supervisor_approved_at = NULL,
        rejection_note = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [req.employeeId, reason, reason, id]
    );
    return res.json({ message: 'Pengajuan berhasil ditolak oleh supervisor' });
  } catch (error) {
    console.error('[lemburRo] rejectSupervisor', error);
    return res.status(500).json({ message: 'Gagal melakukan penolakan supervisor' });
  }
};

export const approveHRD = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'ID tidak valid' });
    }

    const ctx = await getApproverContext(req.employeeId);
    if (!ctx?.isHrd) {
      return res.status(403).json({ message: 'Hanya HRD yang dapat melakukan tindakan ini' });
    }

    const [[item]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_lembur_ro WHERE id = ? LIMIT 1',
      [id]
    );
    if (!item) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
    if (Number(item.employee_id) === Number(req.employeeId)) {
      return res.status(403).json({ message: 'Tidak dapat menyetujui pengajuan sendiri' });
    }
    if (item.status !== 'Pending_HRD') {
      return res.status(400).json({ message: 'Status pengajuan tidak valid untuk persetujuan HRD' });
    }

    await aloraMobilePool.query(
      `UPDATE tr_worker_lembur_ro SET
        status = 'disetujui',
        hrd_id = ?,
        hrd_approved_at = NOW(),
        hrd_rejection_reason = NULL,
        rejection_note = NULL,
        approved_by = ?,
        approved_by_name = ?,
        approved_at = NOW(),
        updated_at = NOW()
       WHERE id = ?`,
      [req.employeeId, req.employeeId, ctx.fullName, id]
    );
    return res.json({ message: 'Pengajuan berhasil disetujui HRD' });
  } catch (error) {
    console.error('[lemburRo] approveHRD', error);
    return res.status(500).json({ message: 'Gagal melakukan approval HRD' });
  }
};

export const rejectHRD = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reason = String(req.body?.reason || '').trim().slice(0, 1000);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'ID tidak valid' });
    }
    if (!reason) {
      return res.status(400).json({ message: 'Alasan penolakan wajib diisi' });
    }

    const ctx = await getApproverContext(req.employeeId);
    if (!ctx?.isHrd) {
      return res.status(403).json({ message: 'Hanya HRD yang dapat menolak pengajuan' });
    }

    const [[item]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_lembur_ro WHERE id = ? LIMIT 1',
      [id]
    );
    if (!item) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
    if (Number(item.employee_id) === Number(req.employeeId)) {
      return res.status(403).json({ message: 'Tidak dapat menolak pengajuan sendiri' });
    }
    if (item.status !== 'Pending_HRD') {
      return res.status(400).json({ message: 'Status pengajuan tidak valid untuk ditolak oleh HRD' });
    }

    await aloraMobilePool.query(
      `UPDATE tr_worker_lembur_ro SET
        status = 'Rejected_HRD',
        hrd_id = ?,
        hrd_rejection_reason = ?,
        hrd_approved_at = NULL,
        rejection_note = ?,
        approved_by = ?,
        approved_by_name = ?,
        approved_at = NULL,
        updated_at = NOW()
       WHERE id = ?`,
      [req.employeeId, reason, reason, req.employeeId, ctx.fullName, id]
    );
    return res.json({ message: 'Pengajuan berhasil ditolak oleh HRD' });
  } catch (error) {
    console.error('[lemburRo] rejectHRD', error);
    return res.status(500).json({ message: 'Gagal melakukan penolakan HRD' });
  }
};
