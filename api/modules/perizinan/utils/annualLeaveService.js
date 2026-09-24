import { aloraMobilePool, mainPool } from '../../../db/pool.js';
import { addDaysDateString, isOffDay, todayDateStringJakarta, toDateOnlyJakarta } from '../../../shared/utils/workScheduleRules.js';

const ANNUAL_GRANT_DAYS = 12;
const PENDING_STATUSES = ['Pending_Supervisor', 'Pending_HRD'];

function toDateOnly(value) {
  return toDateOnlyJakarta(value);
}

export function addYearsDateString(dateStr, years) {
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function endOfCalendarMonth(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export function computeCycleUsableUntil(cycleEnd) {
  const end = toDateOnly(cycleEnd);
  if (!end) return null;
  const [y, m] = end.split('-').map(Number);
  let nextY = y;
  let nextM = m + 1;
  if (nextM > 12) {
    nextM = 1;
    nextY += 1;
  }
  const firstOfNext = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return endOfCalendarMonth(firstOfNext);
}

export function computePreviousCycleStart(cycleStart) {
  return addYearsDateString(cycleStart, -1);
}

export function computeLeaveCycleStart(joinDate, asOfDate) {
  const join = toDateOnly(joinDate);
  const asOf = toDateOnly(asOfDate);
  if (!join || !asOf) return null;

  const firstEligible = addYearsDateString(join, 1);
  if (asOf < firstEligible) return null;

  const [, jm, jd] = join.split('-');
  const [ay] = asOf.split('-').map(Number);
  let cycleYear = ay;
  let anniv = `${cycleYear}-${jm}-${jd}`;
  if (anniv > asOf) {
    cycleYear -= 1;
    anniv = `${cycleYear}-${jm}-${jd}`;
  }
  return anniv;
}

export function computeNextAnniversary(joinDate, asOfDate) {
  const join = toDateOnly(joinDate);
  const asOf = toDateOnly(asOfDate);
  if (!join || !asOf) return null;

  const firstEligible = addYearsDateString(join, 1);
  if (asOf < firstEligible) return firstEligible;

  const cycleStart = computeLeaveCycleStart(join, asOf);
  if (!cycleStart) return firstEligible;
  return addYearsDateString(cycleStart, 1);
}

export async function getEmployeeJoinDate(employeeId) {
  const [rows] = await mainPool.query(
    `SELECT join_date FROM mst_employee WHERE employee_id = ? AND is_deleted = 0 LIMIT 1`,
    [employeeId]
  );
  return rows[0]?.join_date ? toDateOnly(rows[0].join_date) : null;
}

export function isAnnualLeaveEligible(joinDate, asOfDate) {
  return computeLeaveCycleStart(joinDate, asOfDate) !== null;
}

export async function countLeaveDays({ startDate, endDate, durationType }) {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  if (!start || !end || start > end) return 0;

  if (durationType !== 'full_day') {
    if (await isOffDay(start)) return 0;
    return 0.5;
  }

  let total = 0;
  for (let d = start; d <= end; d = addDaysDateString(d, 1)) {
    if (!(await isOffDay(d))) total += 1;
  }
  return total;
}

function allocateLeaveDays(requestedDays, oldAvailable, newAvailable) {
  const requested = Math.max(0, Number(requestedDays) || 0);
  const oldAvail = Math.max(0, Number(oldAvailable) || 0);
  const newAvail = Math.max(0, Number(newAvailable) || 0);
  const fromOld = Math.min(requested, oldAvail);
  const fromNew = Math.round((requested - fromOld) * 100) / 100;
  const ok = fromNew <= newAvail + 1e-9;
  return {
    fromOld: Math.round(fromOld * 100) / 100,
    fromNew,
    ok,
  };
}

function cycleEndFromStart(cycleStart) {
  return addDaysDateString(addYearsDateString(cycleStart, 1), -1);
}

function resolvePreviousCycleWindow(joinDate, currentCycleStart, asOfDate) {
  const firstEligible = addYearsDateString(joinDate, 1);
  const prevCycleStart = computePreviousCycleStart(currentCycleStart);
  if (prevCycleStart < firstEligible) {
    return { active: false, prevCycleStart: null, prevCycleEnd: null, prevUsableUntil: null };
  }
  const prevCycleEnd = cycleEndFromStart(prevCycleStart);
  const prevUsableUntil = computeCycleUsableUntil(prevCycleEnd);
  const asOf = toDateOnly(asOfDate);
  if (!asOf || !prevUsableUntil || asOf > prevUsableUntil) {
    return { active: false, prevCycleStart: null, prevCycleEnd: null, prevUsableUntil: null };
  }
  return { active: true, prevCycleStart, prevCycleEnd, prevUsableUntil };
}

async function getCycleLedgerBalance(employeeId, cycleStart) {
  const [[row]] = await aloraMobilePool.query(
    `SELECT balance_after FROM tr_annual_leave_ledger
     WHERE employee_id = ? AND leave_cycle_start = ?
     ORDER BY id DESC LIMIT 1`,
    [employeeId, cycleStart]
  );
  return row?.balance_after != null ? Number(row.balance_after) : 0;
}

export async function ensureCycleGrant(employeeId, cycleStart) {
  const [[existing]] = await aloraMobilePool.query(
    `SELECT id FROM tr_annual_leave_ledger
     WHERE employee_id = ? AND leave_cycle_start = ? AND mutation_type = 'granted'
     LIMIT 1`,
    [employeeId, cycleStart]
  );
  if (existing) return;

  await aloraMobilePool.query(
    `INSERT INTO tr_annual_leave_ledger
       (employee_id, leave_cycle_start, mutation_type, days, balance_after, note)
     VALUES (?, ?, 'granted', ?, ?, 'Grant otomatis cuti tahunan')`,
    [employeeId, cycleStart, ANNUAL_GRANT_DAYS, ANNUAL_GRANT_DAYS]
  );
}

async function resolvePendingDays(row) {
  if (row.leave_days != null) return Number(row.leave_days);
  return countLeaveDays({
    startDate: row.start_date,
    endDate: row.end_date,
    durationType: row.duration_type,
  });
}

async function sumPendingAllocated({
  employeeId,
  oldCycleStart,
  oldUsableUntil,
  newCycleStart,
  newCycleEnd,
  oldLedger,
  newLedger,
  excludeLeaveId = null,
}) {
  const params = [employeeId, ...PENDING_STATUSES];
  let excludeSql = '';
  if (excludeLeaveId) {
    excludeSql = ' AND id <> ?';
    params.push(excludeLeaveId);
  }

  const [rows] = await aloraMobilePool.query(
    `SELECT id, leave_days, duration_type, start_date, end_date
     FROM tr_worker_leaves
     WHERE employee_id = ?
       AND leave_type = 'cuti'
       AND status IN (?, ?)
       ${excludeSql}
     ORDER BY id ASC`,
    params
  );

  let oldAvail = Math.max(0, Number(oldLedger) || 0);
  let newAvail = Math.max(0, Number(newLedger) || 0);
  let pendingOld = 0;
  let pendingNew = 0;

  for (const row of rows) {
    const start = toDateOnly(row.start_date);
    if (!start) continue;

    const inOld = Boolean(
      oldCycleStart && oldUsableUntil && start >= oldCycleStart && start <= oldUsableUntil
    );
    const inNew = Boolean(
      newCycleStart && newCycleEnd && start >= newCycleStart && start <= newCycleEnd
    );
    if (!inOld && !inNew) continue;

    const days = await resolvePendingDays(row);
    if (days <= 0) continue;

    const { fromOld, fromNew } = allocateLeaveDays(days, oldAvail, newAvail);
    pendingOld = Math.round((pendingOld + fromOld) * 100) / 100;
    pendingNew = Math.round((pendingNew + fromNew) * 100) / 100;
    oldAvail = Math.round((oldAvail - fromOld) * 100) / 100;
    newAvail = Math.round((newAvail - fromNew) * 100) / 100;
  }

  return {
    pending_old: pendingOld,
    pending_new: pendingNew,
    old_remaining_after_pending: Math.max(0, oldAvail),
    new_remaining_after_pending: Math.max(0, newAvail),
  };
}

async function sumUsedLeaveDays(employeeId, cycleStart) {
  const [[row]] = await aloraMobilePool.query(
    `SELECT COALESCE(SUM(days), 0) AS total FROM tr_annual_leave_ledger
     WHERE employee_id = ? AND leave_cycle_start = ? AND mutation_type = 'used'`,
    [employeeId, cycleStart]
  );
  return Number(row?.total || 0);
}

function emptyBalanceFields(joinDate, asOfDate) {
  return {
    eligible: false,
    join_date: joinDate,
    cycle_start: null,
    cycle_end: null,
    usable_until: null,
    granted_days: 0,
    used_days: 0,
    pending_days: 0,
    balance_days: 0,
    previous_cycle_start: null,
    previous_cycle_end: null,
    previous_usable_until: null,
    previous_balance_days: null,
    previous_pending_days: null,
    available_days: 0,
    next_anniversary: joinDate ? computeNextAnniversary(joinDate, asOfDate) : null,
  };
}

export async function getAnnualLeaveBalance(employeeId, asOfDate = todayDateStringJakarta(), excludeLeaveId = null) {
  const joinDate = await getEmployeeJoinDate(employeeId);
  const asOf = toDateOnly(asOfDate) || todayDateStringJakarta();
  const cycleStart = joinDate ? computeLeaveCycleStart(joinDate, asOf) : null;
  const eligible = Boolean(cycleStart);

  if (!eligible) {
    return emptyBalanceFields(joinDate, asOf);
  }

  await ensureCycleGrant(employeeId, cycleStart);
  const cycleEnd = cycleEndFromStart(cycleStart);
  const usableUntil = computeCycleUsableUntil(cycleEnd);
  const newLedger = await getCycleLedgerBalance(employeeId, cycleStart);
  const usedDays = await sumUsedLeaveDays(employeeId, cycleStart);

  const prev = resolvePreviousCycleWindow(joinDate, cycleStart, asOf);
  const oldLedger = prev.active ? await getCycleLedgerBalance(employeeId, prev.prevCycleStart) : 0;

  const allocated = await sumPendingAllocated({
    employeeId,
    oldCycleStart: prev.active ? prev.prevCycleStart : null,
    oldUsableUntil: prev.active ? prev.prevUsableUntil : null,
    newCycleStart: cycleStart,
    newCycleEnd: cycleEnd,
    oldLedger,
    newLedger,
    excludeLeaveId,
  });

  const balanceDays = Math.round(allocated.new_remaining_after_pending * 100) / 100;
  const previousBalanceDays = prev.active
    ? Math.round(allocated.old_remaining_after_pending * 100) / 100
    : null;
  const availableDays = Math.round(
    ((previousBalanceDays || 0) + balanceDays) * 100
  ) / 100;

  return {
    eligible: true,
    join_date: joinDate,
    cycle_start: cycleStart,
    cycle_end: cycleEnd,
    usable_until: usableUntil,
    granted_days: ANNUAL_GRANT_DAYS,
    used_days: usedDays,
    pending_days: allocated.pending_new,
    balance_days: balanceDays,
    previous_cycle_start: prev.active ? prev.prevCycleStart : null,
    previous_cycle_end: prev.active ? prev.prevCycleEnd : null,
    previous_usable_until: prev.active ? prev.prevUsableUntil : null,
    previous_balance_days: previousBalanceDays,
    previous_pending_days: prev.active ? allocated.pending_old : null,
    available_days: availableDays,
    next_anniversary: computeNextAnniversary(joinDate, asOf),
  };
}

export async function appendAnnualLeaveLedger({
  employeeId,
  cycleStart,
  leaveId = null,
  mutationType,
  days,
  note = null,
  createdBy = null,
}) {
  const current = await getCycleLedgerBalance(employeeId, cycleStart);
  let delta = Math.abs(Number(days));
  if (mutationType === 'used') delta = -delta;
  else if (mutationType === 'hr_adjust') delta = Number(days);
  else if (mutationType === 'restored') delta = Math.abs(Number(days));
  else if (mutationType === 'granted') delta = Math.abs(Number(days));

  const balanceAfter = Math.round((current + delta) * 100) / 100;
  const [result] = await aloraMobilePool.query(
    `INSERT INTO tr_annual_leave_ledger
       (employee_id, leave_cycle_start, leave_id, mutation_type, days, balance_after, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      employeeId,
      cycleStart,
      leaveId,
      mutationType,
      Math.abs(Number(days)),
      balanceAfter,
      note,
      createdBy,
    ]
  );
  return { id: result.insertId, balanceAfter };
}

export async function assertSufficientAnnualLeave(employeeId, requestedDays, excludeLeaveId = null) {
  const balance = await getAnnualLeaveBalance(employeeId, todayDateStringJakarta(), excludeLeaveId);
  if (!balance.eligible) {
    const error = new Error('Cuti tahunan tersedia setelah 1 tahun kerja');
    error.statusCode = 422;
    throw error;
  }
  const requested = Math.round(Number(requestedDays) * 100) / 100;
  if (requested <= 0) {
    const error = new Error('Durasi cuti tidak valid');
    error.statusCode = 422;
    throw error;
  }
  const available = balance.available_days != null ? balance.available_days : balance.balance_days;
  if (requested > available) {
    const error = new Error(
      `Saldo cuti tidak mencukupi (tersedia ${available} hari, diminta ${requested} hari)`
    );
    error.statusCode = 422;
    throw error;
  }
  return balance;
}

export async function deductAnnualLeaveForApprovedLeave(leave) {
  if (leave.leave_type !== 'cuti') return null;

  const [[existing]] = await aloraMobilePool.query(
    `SELECT id FROM tr_annual_leave_ledger WHERE leave_id = ? AND mutation_type = 'used' LIMIT 1`,
    [leave.id]
  );
  if (existing) return null;

  const leaveDays = leave.leave_days != null
    ? Number(leave.leave_days)
    : await countLeaveDays({
        startDate: leave.start_date,
        endDate: leave.end_date,
        durationType: leave.duration_type,
      });

  if (leaveDays <= 0) return null;

  const joinDate = await getEmployeeJoinDate(leave.employee_id);
  const asOf = toDateOnly(leave.start_date);
  const cycleStart = computeLeaveCycleStart(joinDate, asOf);
  if (!cycleStart) {
    const error = new Error('Karyawan belum berhak cuti tahunan pada tanggal pengajuan');
    error.statusCode = 400;
    throw error;
  }

  await ensureCycleGrant(leave.employee_id, cycleStart);

  const prev = resolvePreviousCycleWindow(joinDate, cycleStart, asOf);
  const oldLedger = prev.active ? await getCycleLedgerBalance(leave.employee_id, prev.prevCycleStart) : 0;
  const newLedger = await getCycleLedgerBalance(leave.employee_id, cycleStart);
  const { fromOld, fromNew, ok } = allocateLeaveDays(leaveDays, oldLedger, newLedger);

  if (!ok) {
    const error = new Error(
      `Saldo cuti tidak mencukupi (tersedia ${Math.round((oldLedger + newLedger) * 100) / 100} hari, diminta ${leaveDays} hari)`
    );
    error.statusCode = 422;
    throw error;
  }

  const results = [];
  if (fromOld > 0 && prev.active) {
    results.push(
      await appendAnnualLeaveLedger({
        employeeId: leave.employee_id,
        cycleStart: prev.prevCycleStart,
        leaveId: leave.id,
        mutationType: 'used',
        days: fromOld,
        note: `Cuti disetujui #${leave.id} (sisa periode sebelumnya)`,
      })
    );
  }
  if (fromNew > 0) {
    results.push(
      await appendAnnualLeaveLedger({
        employeeId: leave.employee_id,
        cycleStart,
        leaveId: leave.id,
        mutationType: 'used',
        days: fromNew,
        note: `Cuti disetujui #${leave.id}`,
      })
    );
  }

  return results.length === 1 ? results[0] : results;
}

/** Reverse cuti used rows so leave can be re-approved after edit/cancel. */
export async function restoreAnnualLeaveForLeave(leave) {
  if (!leave || leave.leave_type !== 'cuti') return null;

  const [usedRows] = await aloraMobilePool.query(
    `SELECT id, leave_cycle_start, days FROM tr_annual_leave_ledger
     WHERE leave_id = ? AND mutation_type = 'used'`,
    [leave.id]
  );
  if (!usedRows || usedRows.length === 0) return null;

  const results = [];
  for (const row of usedRows) {
    const days = Number(row.days) || 0;
    const cycleStart = toDateOnly(row.leave_cycle_start);
    if (days > 0 && cycleStart) {
      results.push(
        await appendAnnualLeaveLedger({
          employeeId: leave.employee_id,
          cycleStart,
          leaveId: leave.id,
          mutationType: 'restored',
          days,
          note: `Restore cuti diedit/dibatalkan #${leave.id}`,
        })
      );
    }
    await aloraMobilePool.query('DELETE FROM tr_annual_leave_ledger WHERE id = ?', [row.id]);
  }

  return results.length === 1 ? results[0] : results;
}
