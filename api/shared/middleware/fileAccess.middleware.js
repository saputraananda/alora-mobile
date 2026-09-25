import jwt from 'jsonwebtoken';

/**
 * Guard for cross-app file access:
 * - Mobile app: Bearer JWT (existing)
 * - SuperApp server: header X-Alora-Mobile-Secret === SESSION_SECRET
 */
export function requireFileAccess(req, res, next) {
  const expected = (process.env.SESSION_SECRET || '').trim();
  const provided = String(req.headers['x-alora-mobile-secret'] || '').trim();

  if (expected && provided && provided === expected) {
    return next();
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'alora-secret-key-2026');
      if (req.user?.employee_id) {
        req.employeeId = Number(req.user.employee_id);
      }
      return next();
    } catch {
      // fall through
    }
  }

  return res.status(401).json({ message: 'Akses file ditolak' });
}
