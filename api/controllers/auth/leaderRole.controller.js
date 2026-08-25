import { mainPool } from '../../db/pool.js';

function normalizeRoleText(value) {
  return String(value || '').trim().toLowerCase();
}

export function mapLeaderRole(role, jobLevelName) {
  const roleText = normalizeRoleText(role);
  const jobText = normalizeRoleText(jobLevelName);
  const combined = `${roleText} ${jobText}`;

  if (combined.includes('management') || combined.includes('manajemen')) {
    return { role: 'management', is_leader: true };
  }
  if (combined.includes('deputi')) {
    return { role: 'deputi', is_leader: true };
  }
  if (combined.includes('leader')) {
    return { role: 'leader', is_leader: true };
  }

  return { role: null, is_leader: false };
}

export async function resolveLeaderRoleForUser(employeeId, userId) {
  const [rows] = await mainPool.query(
    `SELECT u.role, jl.job_level_name
     FROM users u
     LEFT JOIN mst_employee e ON (u.email = e.email OR u.username = e.employee_code OR u.id = e.employee_id)
     LEFT JOIN mst_job_level jl ON e.job_level_id = jl.job_level_id
     WHERE e.employee_id = ? OR u.id = ?
     LIMIT 1`,
    [employeeId, userId]
  );

  if (!rows?.length) {
    return { role: null, is_leader: false };
  }

  return mapLeaderRole(rows[0].role, rows[0].job_level_name);
}

export const getLeaderRole = async (req, res) => {
  try {
    const employeeId = req.user?.employee_id ? Number(req.user.employee_id) : null;
    const userId = req.user?.id ? Number(req.user.id) : null;

    if (!employeeId && !userId) {
      return res.status(403).json({
        success: false,
        message: 'Akun tidak terdaftar sebagai karyawan',
      });
    }

    const data = await resolveLeaderRoleForUser(employeeId, userId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[auth] getLeaderRole', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memverifikasi role',
    });
  }
};
