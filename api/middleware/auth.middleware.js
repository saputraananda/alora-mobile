import jwt from 'jsonwebtoken';
import { resolveLeaderRoleForUser } from '../controllers/auth/leaderRole.controller.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ message: 'Token tidak ditemukan' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'alora-secret-key-2026');
    return next();
  } catch {
    return res.status(401).json({ message: 'Token tidak valid' });
  }
}

export function requireEmployee(req, res, next) {
  if (!req.user?.employee_id) {
    return res.status(403).json({ message: 'Akun tidak terdaftar sebagai karyawan' });
  }

  req.employeeId = Number(req.user.employee_id);
  return next();
}

export async function requireManagement(req, res, next) {
  try {
    const employeeId = req.employeeId ?? (req.user?.employee_id ? Number(req.user.employee_id) : null);
    const userId = req.user?.id ? Number(req.user.id) : null;
    const { role } = await resolveLeaderRoleForUser(employeeId, userId);

    if (role !== 'management') {
      return res.status(403).json({ message: 'Akses khusus tim manajemen' });
    }

    return next();
  } catch (error) {
    console.error('[auth] requireManagement', error);
    return res.status(500).json({ message: 'Gagal memverifikasi akses manajemen' });
  }
}
