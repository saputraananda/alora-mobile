import { mainPool } from '../db/pool.js';

const USER_SELECT = `
  SELECT
    u.id,
    u.name,
    u.email,
    u.username,
    u.password_hash,
    u.role,
    u.avatar,
    e.employee_id,
    e.employee_code,
    e.full_name,
    jl.job_level_name,
    p.position_name,
    d.department_name
  FROM users u
  LEFT JOIN mst_employee e ON (u.email = e.email OR u.username = e.employee_code OR u.id = e.employee_id)
  LEFT JOIN mst_job_level jl ON e.job_level_id = jl.job_level_id
  LEFT JOIN mst_position p ON e.position_id = p.position_id
  LEFT JOIN mst_department d ON e.department_id = d.department_id
`;

export async function findUserByUsername(username) {
  const trimmed = String(username || '').trim();
  if (!trimmed) return null;
  const [rows] = await mainPool.query(
    `${USER_SELECT} WHERE u.username = ? OR u.email = ? OR e.employee_code = ? LIMIT 1`,
    [trimmed, trimmed, trimmed],
  );
  return rows?.[0] ?? null;
}

export async function findUserById(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const [rows] = await mainPool.query(
    `${USER_SELECT} WHERE u.id = ? LIMIT 1`,
    [id],
  );
  return rows?.[0] ?? null;
}
