import fs from 'fs';
import path from 'path';
import { aloraMobilePool, mainPool } from '../../db/pool.js';
import { ensureUploadFolder } from '../../shared/upload.js';

const INACTIVE_MESSAGE = 'Slip gaji hanya tersedia untuk karyawan aktif';

async function isActiveEmployee(employeeId) {
  const [rows] = await mainPool.query(
    `SELECT employee_id FROM mst_employee
     WHERE employee_id = ? AND is_deleted = 0 AND exit_date IS NULL AND employment_status_id IS NOT NULL
     LIMIT 1`,
    [employeeId]
  );
  return rows.length > 0;
}

export const listMyPayslips = async (req, res) => {
  try {
    if (!(await isActiveEmployee(req.employeeId))) {
      return res.status(403).json({ message: INACTIVE_MESSAGE });
    }
    const [rows] = await aloraMobilePool.query(
      `SELECT id, payslip_month, file_name, updated_at
       FROM tr_payslip_alora
       WHERE employee_id = ?
       ORDER BY payslip_month DESC`,
      [req.employeeId]
    );
    return res.json({ items: rows });
  } catch (error) {
    console.error('[payslip] listMyPayslips', error);
    return res.status(500).json({ message: 'Gagal memuat slip gaji' });
  }
};

export const downloadMyPayslip = async (req, res) => {
  try {
    if (!(await isActiveEmployee(req.employeeId))) {
      return res.status(403).json({ message: INACTIVE_MESSAGE });
    }
    const payslipId = Number(req.params.id);
    if (!Number.isInteger(payslipId) || payslipId <= 0) {
      return res.status(400).json({ message: 'ID slip gaji tidak valid' });
    }
    const [[row]] = await aloraMobilePool.query(
      `SELECT payslip_month, file_path FROM tr_payslip_alora WHERE id = ? AND employee_id = ? LIMIT 1`,
      [payslipId, req.employeeId]
    );
    if (!row) {
      return res.status(404).json({ message: 'Slip gaji tidak ditemukan' });
    }
    const absPath = path.join(ensureUploadFolder('payslip'), path.basename(String(row.file_path || '')));
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ message: 'File slip gaji tidak ditemukan' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Slip-Gaji-${row.payslip_month}.pdf"`);
    return res.sendFile(absPath);
  } catch (error) {
    console.error('[payslip] downloadMyPayslip', error);
    if (res.headersSent) return undefined;
    return res.status(500).json({ message: 'Gagal mengunduh slip gaji' });
  }
};
