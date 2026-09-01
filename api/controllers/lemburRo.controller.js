import { aloraMobilePool } from '../db/pool.js';
import {
  buildPeriodRange,
  statusLabel,
  toDateOnly,
} from '../utils/lemburRoRules.js';
function formatTimeFromDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
}

function serializeRow(row) {
  if (!row) return null;
  return {
    ...row,
    work_date: toDateOnly(row.work_date),
    replacement_date: row.replacement_date ? toDateOnly(row.replacement_date) : null,
    start_at: row.start_at ? new Date(row.start_at).toISOString() : null,
    end_at: row.end_at ? new Date(row.end_at).toISOString() : null,
    start_time: formatTimeFromDate(row.start_at),
    end_time: formatTimeFromDate(row.end_at),
    duration_hours: row.duration_hours != null ? Number(row.duration_hours) : null,
    status_label: statusLabel(row.status),
  };
}

export const listRequests = async (req, res) => {
  const employeeId = req.employeeId;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const offset = (page - 1) * limit;
  const month = parseInt(req.query.month || '0', 10);
  const year = parseInt(req.query.year || '0', 10);
  const requestType = String(req.query.request_type || '').trim();

  try {
    let periodWhere = '';
    const periodParams = [];
    const period = buildPeriodRange(month, year);
    if (period) {
      periodWhere = ' AND work_date >= ? AND work_date <= ?';
      periodParams.push(period.periodStart, period.periodEnd);
    }

    let typeWhere = '';
    const typeParams = [];
    if (requestType === 'lembur' || requestType === 'replace_off') {
      typeWhere = ' AND request_type = ?';
      typeParams.push(requestType);
    }

    const [[{ total }]] = await aloraMobilePool.query(
      `SELECT COUNT(*) AS total FROM tr_worker_lembur_ro
       WHERE employee_id = ?${periodWhere}${typeWhere}`,
      [employeeId, ...periodParams, ...typeParams]
    );

    const [rows] = await aloraMobilePool.query(
      `SELECT id, employee_id, request_type, work_date, start_at, end_at, duration_hours,
              description, compensation_type, replacement_date, status,
              department_id, supervisor_id, supervisor_approved_at, supervisor_rejection_reason,
              hrd_id, hrd_approved_at, hrd_rejection_reason, rejection_note,
              approved_by, approved_by_name, approved_at, created_at, updated_at
       FROM tr_worker_lembur_ro
       WHERE employee_id = ?${periodWhere}${typeWhere}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [employeeId, ...periodParams, ...typeParams, limit, offset]
    );

    return res.json({
      total: Number(total) || 0,
      page,
      limit,
      items: rows.map(serializeRow),
    });
  } catch (error) {
    console.error('[lemburRo] listRequests', error);
    return res.status(500).json({ message: 'Gagal mengambil riwayat pengajuan' });
  }
};

export const getStats = async (req, res) => {
  const employeeId = req.employeeId;
  const month = parseInt(req.query.month || '0', 10);
  const year = parseInt(req.query.year || '0', 10);

  try {
    let whereClause = 'WHERE employee_id = ?';
    const params = [employeeId];
    const period = buildPeriodRange(month, year);
    if (period) {
      whereClause += ' AND work_date >= ? AND work_date <= ?';
      params.push(period.periodStart, period.periodEnd);
    }

    const [rows] = await aloraMobilePool.query(
      `SELECT request_type, status, COUNT(*) AS cnt
       FROM tr_worker_lembur_ro ${whereClause}
       GROUP BY request_type, status`,
      params
    );

    const stats = {
      lembur: 0,
      replace_off: 0,
      pending: 0,
    };
    rows.forEach((r) => {
      if (r.request_type === 'lembur') stats.lembur += Number(r.cnt) || 0;
      if (r.request_type === 'replace_off') stats.replace_off += Number(r.cnt) || 0;
      if (r.status === 'Pending_Supervisor' || r.status === 'Pending_HRD') {
        stats.pending += Number(r.cnt) || 0;
      }
    });

    return res.json({ stats });
  } catch (error) {
    console.error('[lemburRo] getStats', error);
    return res.status(500).json({ message: 'Gagal mengambil statistik' });
  }
};

export const createRequest = async (_req, res) => {
  return res.status(410).json({
    message: 'Pengajuan form Lembur/RO sudah tidak tersedia. Gunakan absensi sesi di Riwayat.',
  });
};

export const updateRequest = async (_req, res) => {
  return res.status(410).json({
    message: 'Pengajuan form Lembur/RO sudah tidak tersedia. Gunakan absensi sesi di Riwayat.',
  });
};

export const cancelRequest = async (_req, res) => {
  return res.status(410).json({
    message: 'Pengajuan form Lembur/RO sudah tidak tersedia. Gunakan absensi sesi di Riwayat.',
  });
};
