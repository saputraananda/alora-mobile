import { mainPool } from '../db/pool.js';

export const HRD_POSITION_IDS = [1, 8, 17, 18, 19];

export function isSpv(jobLevelId) {
  const level = Number(jobLevelId);
  return Number.isFinite(level) && level > 0 && level <= 3;
}

export function isHrd(positionId) {
  return HRD_POSITION_IDS.includes(Number(positionId));
}

export async function getApproverContext(employeeId) {
  const id = Number(employeeId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const [rows] = await mainPool.query(
    `SELECT employee_id, job_level_id, position_id, department_id, full_name
     FROM mst_employee
     WHERE employee_id = ? AND is_deleted = 0
     LIMIT 1`,
    [id]
  );
  const emp = rows[0];
  if (!emp) return null;

  const spv = isSpv(emp.job_level_id);
  const hrd = isHrd(emp.position_id);

  return {
    employeeId: Number(emp.employee_id),
    fullName: emp.full_name || null,
    departmentId: emp.department_id != null ? Number(emp.department_id) : null,
    jobLevelId: emp.job_level_id != null ? Number(emp.job_level_id) : null,
    positionId: emp.position_id != null ? Number(emp.position_id) : null,
    isSpv: spv,
    isHrd: hrd,
    canAccess: spv || hrd,
  };
}
