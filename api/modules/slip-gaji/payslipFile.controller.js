import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { ensureUploadFolder } from '../../shared/upload.js';

const PAYSLIP_SUBFOLDER = 'payslip';
const MAX_PAYSLIP_BYTES = 10 * 1024 * 1024;

function getPayslipDir() {
  return ensureUploadFolder(PAYSLIP_SUBFOLDER);
}

function resolvePayslipFile(fileName) {
  const name = path.basename(String(fileName || ''));
  if (!name || !/^payslip_alora_[\w-]+\.pdf$/i.test(name)) return null;
  return path.join(getPayslipDir(), name);
}

export const payslipFileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, getPayslipDir());
      } catch (err) {
        cb(err);
      }
    },
    filename: (_req, _file, cb) => {
      cb(null, `payslip_alora_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' && file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Slip gaji harus berupa file PDF.'));
    }
  },
  limits: { fileSize: MAX_PAYSLIP_BYTES },
});

export const storePayslipFile = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File PDF wajib diupload' });
  }
  return res.status(201).json({ file_path: req.file.filename });
};

export const servePayslipFile = (req, res) => {
  const absPath = resolvePayslipFile(req.params.fileName);
  if (!absPath) {
    return res.status(400).json({ message: 'Nama file tidak valid' });
  }
  if (!fs.existsSync(absPath)) {
    return res.status(404).json({ message: 'File slip gaji tidak ditemukan' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  return res.sendFile(absPath);
};

export const deletePayslipFile = (req, res) => {
  const absPath = resolvePayslipFile(req.params.fileName);
  if (!absPath) {
    return res.status(400).json({ message: 'Nama file tidak valid' });
  }
  if (fs.existsSync(absPath)) {
    try {
      fs.unlinkSync(absPath);
    } catch (err) {
      console.error('[payslip] deletePayslipFile', err);
    }
  }
  return res.json({ deleted: true });
};
