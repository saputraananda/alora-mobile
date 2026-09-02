import { aloraMobilePool } from '../db/pool.js';
import { isOffDay } from './workScheduleRules.js';

export const FINAL_STATUS_PRIORITY = [
  'CUTI',
  'SAKIT_SKD',
  'SAKIT_NON_SKD',
  'WFA',
  'EARNED_REPLACE_OFF',
  'REPLACE_OFF',
  'OVERTIME_LEAVE',
  'UNPAID_LEAVE',
  'HADIR',
  'OFF',
];

const STATUS_LABELS = {
  CUTI: 'Cuti',
  SAKIT_SKD: 'Sakit (SKD)',
  SAKIT_NON_SKD: 'Sakit (Non-SKD)',
  WFA: 'WFA',
  EARNED_REPLACE_OFF: 'Earned Replace Off',
  REPLACE_OFF: 'Replace Off',
  OVERTIME_LEAVE: 'Overtime Leave',
  UNPAID_LEAVE: 'Unpaid Leave',
  HADIR: 'Hadir',
  OFF: 'Off',
};

function mapLeaveToStatuses(leave) {
  if (!leave || leave.status !== 'disetujui') return [];
  const type = String(leave.leave_type || '').toLowerCase();
  if (type === 'cuti') return ['CUTI'];
  if (type === 'sakit') {
    return leave.doctor_note_path ? ['SAKIT_SKD'] : ['SAKIT_NON_SKD'];
  }
  if (type === 'wfa') return ['WFA'];
  if (type === 'izin') {
    const statuses = [];
    const ro = Number(leave.funding_ro_hours || 0);
    const ot = Number(leave.funding_overtime_hours || 0);
    const unpaid = Number(leave.funding_unpaid_hours || 0);
    if (ro > 0) statuses.push('REPLACE_OFF');
    if (ot > 0) statuses.push('OVERTIME_LEAVE');
    if (unpaid > 0) statuses.push('UNPAID_LEAVE');
    if (statuses.length === 0) statuses.push('REPLACE_OFF');
    return statuses;
  }
  return [];
}

function mapAttendanceToStatuses(attendance) {
  if (!attendance?.clock_in) return [];
  if (attendance.attendance_mode === 'wod' && attendance.approval_status === 'disetujui') {
    return ['EARNED_REPLACE_OFF'];
  }
  if (attendance.attendance_mode === 'wfa' && attendance.approval_status === 'disetujui') {
    return ['WFA'];
  }
  return ['HADIR'];
}

function mapSessionToStatuses(session) {
  if (!session || session.status !== 'disetujui') return [];
  if (session.session_type === 'earned_replace_off') return ['EARNED_REPLACE_OFF'];
  return [];
}

export function resolveFinalStatus({
  date,
  attendance = null,
  leaves = [],
  sessions = [],
}) {
  const candidates = new Set();

  for (const leave of leaves) {
    const start = String(leave.start_date).slice(0, 10);
    const end = String(leave.end_date).slice(0, 10);
    if (date >= start && date <= end) {
      mapLeaveToStatuses(leave).forEach((s) => candidates.add(s));
    }
  }

  for (const session of sessions) {
    const workDate = String(session.work_date).slice(0, 10);
    if (workDate === date) {
      mapSessionToStatuses(session).forEach((s) => candidates.add(s));
    }
  }

  if (attendance) {
    mapAttendanceToStatuses(attendance).forEach((s) => candidates.add(s));
  }

  let approval_pending = false;
  if (
    attendance?.clock_in
    && (attendance.attendance_mode === 'wfa' || attendance.attendance_mode === 'wod')
    && attendance.approval_status === 'Pending_Supervisor'
  ) {
    approval_pending = true;
  }

  let primary_status = 'OFF';
  for (const status of FINAL_STATUS_PRIORITY) {
    if (candidates.has(status)) {
      primary_status = status;
      break;
    }
  }

  if (primary_status === 'OFF' && candidates.size === 0) {
    primary_status = 'OFF';
  }

  let late_flag = null;
  if (primary_status === 'HADIR' && attendance?.late_category) {
    late_flag = attendance.late_category === 'planned' ? 'planned' : 'unexpected';
  }

  const labels = [STATUS_LABELS[primary_status] || primary_status];
  if (late_flag === 'planned') labels.push('Terlambat (Rencana)');
  if (late_flag === 'unexpected') labels.push('Terlambat (Tidak Terduga)');
  if (approval_pending) labels.push('Menunggu approval');

  return {
    primary_status,
    late_flag,
    approval_pending,
    labels,
    status_label: labels.join(' · '),
  };
}

export async function getEmployeeDayContext(employeeId, dateStr) {
  const [[attendance]] = await aloraMobilePool.query(
    `SELECT * FROM tr_worker_attendance WHERE employee_id = ? AND attendance_date = ? LIMIT 1`,
    [employeeId, dateStr]
  );

  const [leaves] = await aloraMobilePool.query(
    `SELECT id, leave_type, start_date, end_date, status, doctor_note_path, duration_type,
            funding_ro_hours, funding_overtime_hours, funding_unpaid_hours
     FROM tr_worker_leaves
     WHERE employee_id = ? AND start_date <= ? AND end_date >= ?`,
    [employeeId, dateStr, dateStr]
  );

  const [sessions] = await aloraMobilePool.query(
    `SELECT id, session_type, work_date, status, duration_hours
     FROM tr_attendance_sessions WHERE employee_id = ? AND work_date = ?`,
    [employeeId, dateStr]
  );

  const offDay = await isOffDay(dateStr);
  const finalStatus = resolveFinalStatus({
    date: dateStr,
    attendance,
    leaves,
    sessions,
  });

  return { attendance, leaves, sessions, is_off_day: offDay, final_status: finalStatus };
}

export async function getEmployeeMonthFinalStatuses(employeeId, startDate, endDate) {
  const [attendanceRows] = await aloraMobilePool.query(
    `SELECT * FROM tr_worker_attendance
     WHERE employee_id = ? AND attendance_date >= ? AND attendance_date < ?`,
    [employeeId, startDate, endDate]
  );

  const [leaveRows] = await aloraMobilePool.query(
    `SELECT id, leave_type, start_date, end_date, status, doctor_note_path,
            funding_ro_hours, funding_overtime_hours, funding_unpaid_hours
     FROM tr_worker_leaves
     WHERE employee_id = ? AND status = 'disetujui'
       AND start_date < ? AND end_date >= ?`,
    [employeeId, endDate, startDate]
  );

  const [sessionRows] = await aloraMobilePool.query(
    `SELECT id, session_type, work_date, status
     FROM tr_attendance_sessions
     WHERE employee_id = ? AND work_date >= ? AND work_date < ?`,
    [employeeId, startDate, endDate]
  );

  const attendanceByDate = new Map(
    attendanceRows.map((r) => [String(r.attendance_date).slice(0, 10), r])
  );

  const result = {};
  const start = new Date(`${startDate}T12:00:00+07:00`);
  const end = new Date(`${endDate}T12:00:00+07:00`);
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    result[dateStr] = resolveFinalStatus({
      date: dateStr,
      attendance: attendanceByDate.get(dateStr) || null,
      leaves: leaveRows,
      sessions: sessionRows,
    });
  }
  return result;
}
