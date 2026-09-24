import { aloraMobilePool } from '../../../db/pool.js';
import {
  dateToCutoffPeriod,
  shiftCutoffPeriod,
  todayDateStringJakarta,
  toDateOnlyJakarta,
} from '../../../shared/utils/workScheduleRules.js';

export async function getOvertimeBalance(employeeId) {
  const [[row]] = await aloraMobilePool.query(
    `SELECT balance_after FROM tr_overtime_ledger
     WHERE employee_id = ? ORDER BY id DESC LIMIT 1`,
    [employeeId]
  );
  return row?.balance_after != null ? Number(row.balance_after) : 0;
}

export async function getReplaceOffBalance(employeeId) {
  const [[row]] = await aloraMobilePool.query(
    `SELECT balance_after FROM tr_replace_off_ledger
     WHERE employee_id = ? ORDER BY id DESC LIMIT 1`,
    [employeeId]
  );
  return row?.balance_after != null ? Number(row.balance_after) : 0;
}

/**
 * Usable OT for izin: earned − used only within the current cutoff period (26–25).
 * New period → automatically 0 until new earns land in that period.
 */
export async function getOvertimeUsableBalance(employeeId, asOfDate) {
  const asOf = toDateOnlyJakarta(asOfDate) || todayDateStringJakarta();
  const period = dateToCutoffPeriod(asOf);
  if (!period) return 0;

  const [[earnedRow]] = await aloraMobilePool.query(
    `SELECT COALESCE(SUM(l.hours), 0) AS total
     FROM tr_overtime_ledger l
     LEFT JOIN tr_attendance_sessions s ON s.id = l.session_id
     WHERE l.employee_id = ?
       AND l.mutation_type = 'earned'
       AND COALESCE(DATE(s.work_date), DATE(l.created_at)) >= ?
       AND COALESCE(DATE(s.work_date), DATE(l.created_at)) <= ?`,
    [employeeId, period.periodStart, period.periodEnd]
  );

  const [[usedRow]] = await aloraMobilePool.query(
    `SELECT COALESCE(SUM(l.hours), 0) AS total
     FROM tr_overtime_ledger l
     LEFT JOIN tr_worker_leaves lv ON lv.id = l.leave_id
     WHERE l.employee_id = ?
       AND l.mutation_type = 'used'
       AND COALESCE(DATE(lv.start_date), DATE(l.created_at)) >= ?
       AND COALESCE(DATE(lv.start_date), DATE(l.created_at)) <= ?`,
    [employeeId, period.periodStart, period.periodEnd]
  );

  const earned = Number(earnedRow?.total) || 0;
  const used = Number(usedRow?.total) || 0;
  return Math.max(0, Math.round((earned - used) * 100) / 100);
}

/**
 * Usable RO for izin: FIFO remaining of earned lots still within earnPeriod … earnPeriod+3.
 */
export async function getReplaceOffUsableBalance(employeeId, asOfDate) {
  const asOf = toDateOnlyJakarta(asOfDate) || todayDateStringJakarta();

  const [earnedRows] = await aloraMobilePool.query(
    `SELECT l.id, l.hours,
            COALESCE(a.attendance_date, DATE(l.created_at)) AS earn_date
     FROM tr_replace_off_ledger l
     LEFT JOIN tr_worker_attendance a ON a.id = l.attendance_id
     WHERE l.employee_id = ?
       AND l.mutation_type = 'earned'
     ORDER BY l.id ASC`,
    [employeeId]
  );

  const [usedRows] = await aloraMobilePool.query(
    `SELECT l.id, l.hours
     FROM tr_replace_off_ledger l
     WHERE l.employee_id = ?
       AND l.mutation_type = 'used'
     ORDER BY l.id ASC`,
    [employeeId]
  );

  const lots = (earnedRows || []).map((row) => {
    const earnDate = toDateOnlyJakarta(row.earn_date);
    const earnPeriod = dateToCutoffPeriod(earnDate);
    const untilPeriod = earnPeriod ? shiftCutoffPeriod(earnPeriod, 3) : null;
    return {
      remaining: Math.max(0, Number(row.hours) || 0),
      usableUntil: untilPeriod?.periodEnd || null,
    };
  });

  for (const used of usedRows || []) {
    let need = Math.max(0, Number(used.hours) || 0);
    for (const lot of lots) {
      if (need <= 0) break;
      if (lot.remaining <= 0) continue;
      const take = Math.min(lot.remaining, need);
      lot.remaining = Math.round((lot.remaining - take) * 100) / 100;
      need = Math.round((need - take) * 100) / 100;
    }
  }

  let usable = 0;
  for (const lot of lots) {
    if (!lot.usableUntil || asOf > lot.usableUntil) continue;
    usable += lot.remaining;
  }
  return Math.max(0, Math.round(usable * 100) / 100);
}

export async function appendOvertimeLedger({
  employeeId,
  sessionId = null,
  leaveId = null,
  mutationType,
  hours,
  note = null,
}) {
  const current = await getOvertimeBalance(employeeId);
  const delta = mutationType === 'used' ? -Math.abs(Number(hours)) : Math.abs(Number(hours));
  const balanceAfter = Math.round((current + delta) * 100) / 100;

  const [result] = await aloraMobilePool.query(
    `INSERT INTO tr_overtime_ledger
       (employee_id, session_id, leave_id, mutation_type, hours, balance_after, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [employeeId, sessionId, leaveId, mutationType, Math.abs(Number(hours)), balanceAfter, note]
  );
  return { id: result.insertId, balanceAfter };
}

export async function appendReplaceOffLedger({
  employeeId,
  sessionId = null,
  leaveId = null,
  attendanceId = null,
  mutationType,
  hours,
  note = null,
}) {
  const current = await getReplaceOffBalance(employeeId);
  const delta = mutationType === 'used' ? -Math.abs(Number(hours)) : Math.abs(Number(hours));
  const balanceAfter = Math.round((current + delta) * 100) / 100;

  const [result] = await aloraMobilePool.query(
    `INSERT INTO tr_replace_off_ledger
       (employee_id, session_id, leave_id, attendance_id, mutation_type, hours, balance_after, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [employeeId, sessionId, leaveId, attendanceId, mutationType, Math.abs(Number(hours)), balanceAfter, note]
  );
  return { id: result.insertId, balanceAfter };
}
