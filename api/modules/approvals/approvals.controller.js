import { aloraMobilePool, mainPool } from '../../db/pool.js';
import { getApproverContext } from '../../shared/utils/approvalAccess.js';
import { MODE_REQUEST_STATUSES, toDateOnly } from '../absensi/utils/attendanceModeRequestRules.js';

async function getEmployeeMap(employeeIds) {
  const uniqueIds = [...new Set(employeeIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (uniqueIds.length === 0) return new Map();
  const placeholders = uniqueIds.map(() => '?').join(',');
  const [rows] = await mainPool.query(
    `SELECT employee_id, full_name, department_id
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

function leaveTitle(leaveType) {
  const t = String(leaveType || '').toLowerCase();
  if (t === 'cuti') return 'Cuti';
  if (t === 'sakit') return 'Sakit';
  if (t === 'izin') return 'Izin';
  return 'Perizinan';
}

async function fetchModeInbox(ctx, typeFilter = null) {
  if (!ctx.isSpv) return [];

  const where = ['status = ?'];
  const params = [MODE_REQUEST_STATUSES.PENDING];
  if (typeFilter === 'wfa' || typeFilter === 'wod') {
    where.push('request_type = ?');
    params.push(typeFilter);
  } else if (typeFilter && typeFilter !== 'all') {
    return [];
  }

  const [rows] = await aloraMobilePool.query(
    `SELECT * FROM tr_attendance_mode_requests
     WHERE ${where.join(' AND ')}
     ORDER BY created_at ASC
     LIMIT 200`,
    params
  );

  const empMap = await getEmployeeMap(rows.map((r) => r.employee_id));
  return rows
    .filter((row) => {
      if (Number(row.employee_id) === Number(ctx.employeeId)) return false;
      const emp = empMap.get(Number(row.employee_id));
      if (!emp) return false;
      if (ctx.departmentId != null && Number(emp.department_id) !== ctx.departmentId) return false;
      return true;
    })
    .map((row) => {
      const emp = empMap.get(Number(row.employee_id));
      const kind = String(row.request_type || '').toLowerCase() === 'wod' ? 'wod' : 'wfa';
      return {
        kind,
        id: Number(row.id),
        employee_id: Number(row.employee_id),
        employee_name: emp?.full_name || null,
        title: kind.toUpperCase(),
        subtitle: row.reason || '',
        work_date: toDateOnly(row.work_date),
        status: row.status,
        action_role: 'spv',
        meta: { reason: row.reason },
      };
    });
}

async function fetchLeaveInbox(ctx, typeFilter = null) {
  if (typeFilter && typeFilter !== 'all' && typeFilter !== 'leave') return [];
  if (!ctx.isSpv && !ctx.isHrd) return [];

  const where = [];
  const params = [];
  if (ctx.isSpv && ctx.isHrd) {
    where.push(`(status = 'Pending_Supervisor' OR status = 'Pending_HRD')`);
  } else if (ctx.isSpv) {
    where.push(`status = 'Pending_Supervisor'`);
  } else {
    where.push(`status = 'Pending_HRD'`);
  }

  const [rows] = await aloraMobilePool.query(
    `SELECT * FROM tr_worker_leaves
     WHERE ${where.join(' AND ')}
     ORDER BY created_at ASC
     LIMIT 200`,
    params
  );

  const empMap = await getEmployeeMap(rows.map((r) => r.employee_id));
  return rows
    .filter((row) => {
      if (Number(row.employee_id) === Number(ctx.employeeId)) return false;
      if (row.status === 'Pending_Supervisor' && ctx.isSpv) {
        if (ctx.departmentId != null && Number(row.department_id) !== ctx.departmentId) return false;
        return true;
      }
      if (row.status === 'Pending_HRD' && ctx.isHrd) return true;
      return false;
    })
    .map((row) => {
      const emp = empMap.get(Number(row.employee_id));
      const start = toDateOnly(row.start_date);
      const end = toDateOnly(row.end_date);
      const dateLabel = start && end && start !== end ? `${start} – ${end}` : start;
      return {
        kind: 'leave',
        id: Number(row.id),
        employee_id: Number(row.employee_id),
        employee_name: emp?.full_name || null,
        title: leaveTitle(row.leave_type),
        subtitle: row.reason || row.description || dateLabel || '',
        work_date: start,
        status: row.status,
        action_role: row.status === 'Pending_HRD' ? 'hrd' : 'spv',
        meta: {
          leave_type: row.leave_type,
          duration_type: row.duration_type,
          start_date: start,
          end_date: end,
        },
      };
    });
}

async function fetchLemburInbox(ctx, typeFilter = null) {
  if (typeFilter && typeFilter !== 'all' && typeFilter !== 'lembur') return [];
  if (!ctx.isSpv && !ctx.isHrd) return [];

  const where = [];
  const params = [];
  if (ctx.isSpv && ctx.isHrd) {
    where.push(`(status = 'Pending_Supervisor' OR status = 'Pending_HRD')`);
  } else if (ctx.isSpv) {
    where.push(`status = 'Pending_Supervisor'`);
  } else {
    where.push(`status = 'Pending_HRD'`);
  }

  const [rows] = await aloraMobilePool.query(
    `SELECT * FROM tr_worker_lembur_ro
     WHERE ${where.join(' AND ')}
     ORDER BY created_at ASC
     LIMIT 200`,
    params
  );

  const empMap = await getEmployeeMap(rows.map((r) => r.employee_id));
  return rows
    .filter((row) => {
      if (Number(row.employee_id) === Number(ctx.employeeId)) return false;
      if (row.status === 'Pending_Supervisor' && ctx.isSpv) {
        if (ctx.departmentId != null && Number(row.department_id) !== ctx.departmentId) return false;
        return true;
      }
      if (row.status === 'Pending_HRD' && ctx.isHrd) return true;
      return false;
    })
    .map((row) => {
      const emp = empMap.get(Number(row.employee_id));
      const hours = row.duration_hours != null ? Number(row.duration_hours) : null;
      return {
        kind: 'lembur',
        id: Number(row.id),
        employee_id: Number(row.employee_id),
        employee_name: emp?.full_name || null,
        title: 'Lembur',
        subtitle: hours != null ? `${hours} jam` : (row.description || ''),
        work_date: toDateOnly(row.work_date),
        status: row.status,
        action_role: row.status === 'Pending_HRD' ? 'hrd' : 'spv',
        meta: {
          duration_hours: hours,
          description: row.description,
        },
      };
    });
}

async function buildInbox(ctx, typeFilter = 'all') {
  const filter = String(typeFilter || 'all').trim().toLowerCase() || 'all';
  const [modeItems, leaveItems, lemburItems] = await Promise.all([
    filter === 'all' || filter === 'wfa' || filter === 'wod'
      ? fetchModeInbox(ctx, filter === 'all' ? null : filter)
      : Promise.resolve([]),
    fetchLeaveInbox(ctx, filter),
    fetchLemburInbox(ctx, filter),
  ]);

  const items = [...modeItems, ...leaveItems, ...lemburItems];
  items.sort((a, b) => {
    const da = String(a.work_date || '');
    const db = String(b.work_date || '');
    if (da !== db) return da.localeCompare(db);
    return Number(a.id) - Number(b.id);
  });
  return items;
}

export const getCapability = async (req, res) => {
  try {
    const ctx = await getApproverContext(req.employeeId);
    return res.json({
      can_access: Boolean(ctx?.canAccess),
      is_spv: Boolean(ctx?.isSpv),
      is_hrd: Boolean(ctx?.isHrd),
    });
  } catch (error) {
    console.error('[approvals] capability', error);
    return res.status(500).json({ message: 'Gagal cek kapabilitas approval' });
  }
};

export const getSummary = async (req, res) => {
  try {
    const ctx = await getApproverContext(req.employeeId);
    if (!ctx?.canAccess) {
      return res.json({
        can_access: false,
        is_spv: false,
        is_hrd: false,
        total: 0,
        by_type: { wfa: 0, wod: 0, lembur: 0, leave: 0 },
      });
    }

    const items = await buildInbox(ctx, 'all');
    const by_type = { wfa: 0, wod: 0, lembur: 0, leave: 0 };
    for (const item of items) {
      if (item.kind in by_type) by_type[item.kind] += 1;
    }

    return res.json({
      can_access: true,
      is_spv: ctx.isSpv,
      is_hrd: ctx.isHrd,
      total: items.length,
      by_type,
    });
  } catch (error) {
    console.error('[approvals] summary', error);
    return res.status(500).json({ message: 'Gagal mengambil ringkasan approval' });
  }
};

export const getInbox = async (req, res) => {
  try {
    const ctx = await getApproverContext(req.employeeId);
    if (!ctx?.canAccess) {
      return res.status(403).json({ message: 'Hanya SPV atau HRD yang dapat mengakses approval' });
    }

    const type = String(req.query.type || 'all').trim().toLowerCase() || 'all';
    const items = await buildInbox(ctx, type);
    return res.json({ items });
  } catch (error) {
    console.error('[approvals] inbox', error);
    return res.status(500).json({ message: 'Gagal mengambil inbox approval' });
  }
};
