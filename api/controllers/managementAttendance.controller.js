import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import { aloraMobilePool } from '../db/pool.js';
import { getBaseUploadDir } from '../middleware/upload.js';

const MANAGEMENT_LOCATION_LABEL = 'Alora Management';
const ATTENDANCE_BASE = path.join(getBaseUploadDir(), 'attendance');

if (!fs.existsSync(ATTENDANCE_BASE)) fs.mkdirSync(ATTENDANCE_BASE, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('File absensi harus berupa gambar'));
  },
});

export const selfieUploadMiddleware = upload.single('selfie');

function todayDateString() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const jakarta = new Date(utc + 7 * 60 * 60000);
  return jakarta.toISOString().slice(0, 10);
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

async function compressToJpg(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

function attendancePhotoFileName(employeeId, attendanceDate, fieldName) {
  return `${employeeId}_${attendanceDate}_${fieldName}.jpg`;
}

function unlinkAttendancePhoto(employeeId, attendanceDate, fieldName, storedPath) {
  const names = new Set([attendancePhotoFileName(employeeId, attendanceDate, fieldName)]);
  if (storedPath) {
    names.add(path.basename(String(storedPath)));
  }

  for (const name of names) {
    if (!name || name === '.' || name === '..') continue;
    const fullPath = path.join(ATTENDANCE_BASE, name);
    if (!fullPath.startsWith(ATTENDANCE_BASE)) continue;
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
}

async function savePhoto(employeeId, attendanceDate, fieldName, file) {
  const fileName = attendancePhotoFileName(employeeId, attendanceDate, fieldName);
  const filePath = path.join(ATTENDANCE_BASE, fileName);
  const buffer = await compressToJpg(file.buffer);
  fs.writeFileSync(filePath, buffer);
  return {
    file: fileName,
    path: `/api/attendance/file/${fileName}`,
  };
}

async function getTodayRow(employeeId) {
  const today = todayDateString();
  const [[row]] = await aloraMobilePool.query(
    `SELECT * FROM tr_worker_attendance
     WHERE employee_id = ? AND attendance_date = ?
     LIMIT 1`,
    [employeeId, today]
  );
  return row || null;
}

function serializeManagementToday(row) {
  if (!row) {
    return {
      check_in_time: null,
      check_out_time: null,
      check_in_photo_path: null,
      check_out_photo_path: null,
      clock_in_location_name: null,
      clock_out_location_name: null,
    };
  }

  return {
    check_in_time: row.clock_in ?? null,
    check_out_time: row.clock_out ?? null,
    check_in_photo_path: row.foto_masuk_path ?? null,
    check_out_photo_path: row.foto_keluar_path ?? null,
    clock_in_location_name: row.clock_in_location_name ?? null,
    clock_out_location_name: row.clock_out_location_name ?? null,
  };
}

function parsePunchType(value) {
  const punchType = String(value || '').trim().toLowerCase();
  if (punchType !== 'in' && punchType !== 'out') {
    const error = new Error('punch_type harus in atau out');
    error.statusCode = 400;
    throw error;
  }
  return punchType;
}

export const getManagementToday = async (req, res) => {
  try {
    const row = await getTodayRow(req.employeeId);
    return res.json({ data: serializeManagementToday(row) });
  } catch (error) {
    console.error('[management-attendance] getManagementToday', error);
    return res.status(500).json({ message: 'Gagal mengambil absensi hari ini' });
  }
};

export const punchManagementSelfie = async (req, res) => {
  const employeeId = req.employeeId;
  const today = todayDateString();

  try {
    if (!req.file) {
      return res.status(422).json({ message: 'Selfie wajib dilampirkan' });
    }

    const punchType = parsePunchType(req.body.punch_type);
    const existing = await getTodayRow(employeeId);

    if (punchType === 'in') {
      if (existing?.clock_in) {
        return res.status(409).json({ message: 'Anda sudah absen masuk hari ini' });
      }

      const saved = await savePhoto(employeeId, today, 'foto_masuk', req.file);

      if (!existing) {
        const [result] = await aloraMobilePool.query(
          `INSERT INTO tr_worker_attendance
             (employee_id, attendance_date, clock_in, foto_masuk_path,
              clock_in_latitude, clock_in_longitude, clock_in_location_name, location_absen_id)
           VALUES (?, ?, NOW(), ?, NULL, NULL, ?, NULL)`,
          [employeeId, today, saved.path, MANAGEMENT_LOCATION_LABEL]
        );
        const [[inserted]] = await aloraMobilePool.query(
          'SELECT * FROM tr_worker_attendance WHERE id = ?',
          [result.insertId]
        );
        return res.status(201).json({
          message: 'Absen masuk berhasil',
          data: serializeManagementToday(inserted),
        });
      }

      await aloraMobilePool.query(
        `UPDATE tr_worker_attendance
         SET clock_in = NOW(),
             foto_masuk_path = ?,
             clock_in_latitude = NULL,
             clock_in_longitude = NULL,
             clock_in_location_name = ?,
             location_absen_id = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [saved.path, MANAGEMENT_LOCATION_LABEL, existing.id]
      );
      const [[updated]] = await aloraMobilePool.query(
        'SELECT * FROM tr_worker_attendance WHERE id = ?',
        [existing.id]
      );
      return res.status(201).json({
        message: 'Absen masuk berhasil',
        data: serializeManagementToday(updated),
      });
    }

    if (!existing?.clock_in) {
      return res.status(409).json({ message: 'Anda belum absen masuk hari ini' });
    }
    if (existing.clock_out) {
      return res.status(409).json({ message: 'Anda sudah absen keluar hari ini' });
    }

    const saved = await savePhoto(employeeId, today, 'foto_keluar', req.file);
    await aloraMobilePool.query(
      `UPDATE tr_worker_attendance
       SET clock_out = NOW(),
           foto_keluar_path = ?,
           clock_out_latitude = NULL,
           clock_out_longitude = NULL,
           clock_out_location_name = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [saved.path, MANAGEMENT_LOCATION_LABEL, existing.id]
    );
    const [[updated]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_attendance WHERE id = ?',
      [existing.id]
    );
    return res.status(200).json({
      message: 'Absen keluar berhasil',
      data: serializeManagementToday(updated),
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error('[management-attendance] punchManagementSelfie', error);
    return res.status(status).json({ message: error.message || 'Gagal menyimpan absensi' });
  }
};

export const deleteManagementPunch = async (req, res) => {
  const employeeId = req.employeeId;
  const today = todayDateString();

  try {
    const punchType = parsePunchType(req.body.punch_type);
    const existing = await getTodayRow(employeeId);

    if (!existing) {
      return res.status(409).json({ message: 'Absensi hari ini belum tercatat' });
    }
    if (toDateOnly(existing.attendance_date) !== today) {
      return res.status(403).json({ message: 'Absensi hanya dapat dihapus pada hari yang sama' });
    }

    if (punchType === 'in') {
      if (!existing.clock_in) {
        return res.status(409).json({ message: 'Absen masuk belum tercatat' });
      }
      if (existing.clock_out) {
        return res.status(409).json({ message: 'Tidak dapat menghapus absen masuk setelah absen keluar' });
      }

      unlinkAttendancePhoto(employeeId, today, 'foto_masuk', existing.foto_masuk_path);
      await aloraMobilePool.query(
        `UPDATE tr_worker_attendance
         SET clock_in = NULL,
             foto_masuk_path = NULL,
             clock_in_latitude = NULL,
             clock_in_longitude = NULL,
             clock_in_location_name = NULL,
             location_absen_id = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [existing.id]
      );
    } else {
      if (!existing.clock_out) {
        return res.status(409).json({ message: 'Absen keluar belum tercatat' });
      }

      unlinkAttendancePhoto(employeeId, today, 'foto_keluar', existing.foto_keluar_path);
      await aloraMobilePool.query(
        `UPDATE tr_worker_attendance
         SET clock_out = NULL,
             foto_keluar_path = NULL,
             clock_out_latitude = NULL,
             clock_out_longitude = NULL,
             clock_out_location_name = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [existing.id]
      );
    }

    const [[updated]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_attendance WHERE id = ?',
      [existing.id]
    );

    return res.status(200).json({
      message: 'Absensi dihapus. Silakan absen ulang.',
      data: serializeManagementToday(updated),
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error('[management-attendance] deleteManagementPunch', error);
    return res.status(status).json({ message: error.message || 'Gagal menghapus absensi' });
  }
};
