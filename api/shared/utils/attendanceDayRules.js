import { isHoliday, isOffDay, jakartaWeekday } from './workScheduleRules.js';

// Boleh absen Harian di hari Minggu tanpa WOD dan tanpa aturan terlambat (188 = Angel)
export const SUNDAY_OPEN_EMPLOYEE_IDS = [188];

export function isSundayOpenForEmployee(employeeId, dateStr) {
  return SUNDAY_OPEN_EMPLOYEE_IDS.includes(Number(employeeId)) && jakartaWeekday(dateStr) === 0;
}

export async function isAttendanceOffDay(employeeId, dateStr) {
  if (isSundayOpenForEmployee(employeeId, dateStr)) {
    return isHoliday(dateStr);
  }
  return isOffDay(dateStr);
}
