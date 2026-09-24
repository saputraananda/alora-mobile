import { appendOvertimeLedger, appendReplaceOffLedger } from './ledgerService.js';
import { aloraMobilePool } from '../../../db/pool.js';

export async function applyLeaveFundingOnApprove(leave) {
  if (!leave || leave.leave_type !== 'izin') return null;

  const roHours = Number(leave.funding_ro_hours || 0);
  const otHours = Number(leave.funding_overtime_hours || 0);
  if (roHours <= 0 && otHours <= 0) return null;

  const employeeId = leave.employee_id;
  const leaveId = leave.id;

  const [[existingRo]] = await aloraMobilePool.query(
    `SELECT id FROM tr_replace_off_ledger WHERE leave_id = ? AND mutation_type = 'used' LIMIT 1`,
    [leaveId]
  );
  const [[existingOt]] = await aloraMobilePool.query(
    `SELECT id FROM tr_overtime_ledger WHERE leave_id = ? AND mutation_type = 'used' LIMIT 1`,
    [leaveId]
  );
  if (existingRo || existingOt) return null;

  if (roHours > 0) {
    await appendReplaceOffLedger({
      employeeId,
      leaveId,
      mutationType: 'used',
      hours: roHours,
      note: `Izin disetujui #${leaveId}`,
    });
  }
  if (otHours > 0) {
    await appendOvertimeLedger({
      employeeId,
      leaveId,
      mutationType: 'used',
      hours: otHours,
      note: `Izin disetujui #${leaveId}`,
    });
  }

  return { roHours, otHours };
}

/** Reverse RO/OT used rows so leave can be re-approved after edit/cancel. */
export async function restoreLeaveFundingForLeave(leave) {
  if (!leave || leave.leave_type !== 'izin') return null;

  const employeeId = leave.employee_id;
  const leaveId = leave.id;

  const [roUsedRows] = await aloraMobilePool.query(
    `SELECT id, hours FROM tr_replace_off_ledger
     WHERE leave_id = ? AND mutation_type = 'used'`,
    [leaveId]
  );
  const [otUsedRows] = await aloraMobilePool.query(
    `SELECT id, hours FROM tr_overtime_ledger
     WHERE leave_id = ? AND mutation_type = 'used'`,
    [leaveId]
  );

  if ((!roUsedRows || roUsedRows.length === 0) && (!otUsedRows || otUsedRows.length === 0)) {
    return null;
  }

  let restoredRo = 0;
  let restoredOt = 0;

  for (const row of roUsedRows || []) {
    const hours = Number(row.hours) || 0;
    if (hours > 0) {
      await appendReplaceOffLedger({
        employeeId,
        leaveId,
        mutationType: 'restored',
        hours,
        note: `Restore izin diedit/dibatalkan #${leaveId}`,
      });
      restoredRo += hours;
    }
    await aloraMobilePool.query('DELETE FROM tr_replace_off_ledger WHERE id = ?', [row.id]);
  }

  for (const row of otUsedRows || []) {
    const hours = Number(row.hours) || 0;
    if (hours > 0) {
      await appendOvertimeLedger({
        employeeId,
        leaveId,
        mutationType: 'restored',
        hours,
        note: `Restore izin diedit/dibatalkan #${leaveId}`,
      });
      restoredOt += hours;
    }
    await aloraMobilePool.query('DELETE FROM tr_overtime_ledger WHERE id = ?', [row.id]);
  }

  return {
    restoredRo: Math.round(restoredRo * 100) / 100,
    restoredOt: Math.round(restoredOt * 100) / 100,
  };
}
