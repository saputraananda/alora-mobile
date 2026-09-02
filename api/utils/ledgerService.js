import { aloraMobilePool } from '../db/pool.js';

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
