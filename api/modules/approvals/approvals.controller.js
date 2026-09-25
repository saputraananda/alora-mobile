import { aloraMobilePool, mainPool } from '../../db/pool.js';
import { getApproverContext } from '../../shared/utils/approvalAccess.js';
import { dateToCutoffPeriod } from '../../shared/utils/workScheduleRules.js';
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

function roundHours(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function getApprovedLemburHoursMap(employeeIds, periodStart, periodEnd) {
  const uniqueIds = [...new Set(
    (employeeIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
  )];
  if (uniqueIds.length === 0 || !periodStart || !periodEnd) return new Map();

  const placeholders = uniqueIds.map(() => '?').join(',');
  const [rows] = await aloraMobilePool.query(
    `SELECT employee_id, COALESCE(SUM(duration_hours), 0) AS total
     FROM tr_worker_lembur_ro
     WHERE status = 'disetujui'
       AND employee_id IN (${placeholders})
       AND work_date >= ?
       AND work_date <= ?
     GROUP BY employee_id`,
    [...uniqueIds, periodStart, periodEnd]
  );

  const map = new Map();
  for (const row of rows) {
    map.set(Number(row.employee_id), roundHours(row.total));
  }
  return map;
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
  const visibleRows = rows.filter((row) => {
    if (Number(row.employee_id) === Number(ctx.employeeId)) return false;
    if (row.status === 'Pending_Supervisor' && ctx.isSpv) {
      if (ctx.departmentId != null && Number(row.department_id) !== ctx.departmentId) return false;
      return true;
    }
    if (row.status === 'Pending_HRD' && ctx.isHrd) return true;
    return false;
  });

  const periodEmployeeIds = new Map();
  for (const row of visibleRows) {
    const workDate = toDateOnly(row.work_date);
    const period = dateToCutoffPeriod(workDate);
    if (!period) continue;
    const key = `${period.periodStart}|${period.periodEnd}`;
    if (!periodEmployeeIds.has(key)) {
      periodEmployeeIds.set(key, {
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        employeeIds: new Set(),
      });
    }
    periodEmployeeIds.get(key).employeeIds.add(Number(row.employee_id));
  }

  const approvedHoursByPeriod = new Map();
  await Promise.all(
    [...periodEmployeeIds.entries()].map(async ([key, group]) => {
      const hoursMap = await getApprovedLemburHoursMap(
        [...group.employeeIds],
        group.periodStart,
        group.periodEnd
      );
      approvedHoursByPeriod.set(key, hoursMap);
    })
  );

  return visibleRows.map((row) => {
    const emp = empMap.get(Number(row.employee_id));
    const hours = row.duration_hours != null ? Number(row.duration_hours) : null;
    const description = String(row.description || '').trim();
    const parsedTodos = parseTodoItems(row.todo_items);
    const todoItems = Array.isArray(parsedTodos)
      ? parsedTodos.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const workDate = toDateOnly(row.work_date);
    const period = dateToCutoffPeriod(workDate);
    const periodKey = period ? `${period.periodStart}|${period.periodEnd}` : null;
    const approvedMap = periodKey ? approvedHoursByPeriod.get(periodKey) : null;
    const approvedPeriodHours = approvedMap?.get(Number(row.employee_id)) ?? 0;
    return {
      kind: 'lembur',
      id: Number(row.id),
      employee_id: Number(row.employee_id),
      employee_name: emp?.full_name || null,
      title: 'Lembur',
      subtitle: hours != null ? `${hours} jam` : '',
      description,
      todo_items: todoItems,
      work_date: workDate,
      approved_period_hours: approvedPeriodHours,
      period_month: period?.month || null,
      period_year: period?.year || null,
      period_start: period?.periodStart || null,
      period_end: period?.periodEnd || null,
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
