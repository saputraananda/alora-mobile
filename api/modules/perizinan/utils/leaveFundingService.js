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
