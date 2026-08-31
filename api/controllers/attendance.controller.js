import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import { aloraMobilePool } from '../db/pool.js';
import { getBaseUploadDir } from '../middleware/upload.js';

const HO_LOCATION_CODE = 'HO-ALR';
const ABSEN_RADIUS_KM = 2;
const INSIDE_LOCATION_LABEL = 'HO Alora';
const OUTSIDE_LOCATION_LABEL = 'Lokasi diluar jangkauan';
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

export const fotoMasukUploadMiddleware = upload.single('foto_masuk');
export const fotoKeluarUploadMiddleware = upload.single('foto_keluar');

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

function parseCoordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function serializeAttendance(row) {
  if (!row) return null;
  return {
    ...row,
    attendance_date: toDateOnly(row.attendance_date),
  };
}

async function getHoLocation() {
  const [[row]] = await aloraMobilePool.query(
    `SELECT id, location_id, location_name, latitude, longitude
     FROM mst_location_absen
     WHERE location_id = ?
     LIMIT 1`,
    [HO_LOCATION_CODE]
  );
  return row || null;
}

async function assertNotLockedByApprovedFullDayLeave(employeeId) {
  const today = todayDateString();
  const [rows] = await aloraMobilePool.query(
    `SELECT id FROM tr_worker_leaves
     WHERE employee_id = ?
       AND status = 'disetujui'
       AND duration_type = 'full_day'
       AND start_date <= ?
       AND end_date >= ?
     LIMIT 1`,
    [employeeId, today, today]
  );
  if (rows.length > 0) {
    const error = new Error('Absensi dikunci karena cuti/izin seharian penuh yang sudah disetujui');
    error.statusCode = 403;
    throw error;
  }
}

async function resolvePunchLocation(latitude, longitude) {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  if (lat === null || lng === null) {
    const error = new Error('Koordinat GPS absensi tidak valid');
    error.statusCode = 400;
    throw error;
  }

  const office = await getHoLocation();
  if (!office) {
    const error = new Error('Lokasi absensi HO-ALR belum tersedia');
    error.statusCode = 500;
    throw error;
  }

  const officeLat = Number(office.latitude);
  const officeLng = Number(office.longitude);
  if (!Number.isFinite(officeLat) || !Number.isFinite(officeLng)) {
    const error = new Error('Koordinat Head Office Alora tidak valid');
    error.statusCode = 500;
    throw error;
  }

  const km = distanceKm(lat, lng, officeLat, officeLng);
  const insideRadius = km <= ABSEN_RADIUS_KM;
  const locationName = insideRadius ? INSIDE_LOCATION_LABEL : OUTSIDE_LOCATION_LABEL;

  return { office, lat, lng, locationName, insideRadius };
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

function requireTodayPhotoEdit(existing, today, clockField, missingMessage) {
  if (!existing || !existing[clockField]) {
    const error = new Error(missingMessage);
    error.statusCode = 409;
    throw error;
  }
  if (toDateOnly(existing.attendance_date) !== today) {
    const error = new Error('Foto hanya dapat diubah pada hari yang sama');
    error.statusCode = 403;
    throw error;
  }
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

export const getTodayAttendance = async (req, res) => {
  try {
    const row = await getTodayRow(req.employeeId);
    return res.json({ attendance: serializeAttendance(row) });
  } catch (error) {
    console.error('[attendance] getTodayAttendance', error);
    return res.status(500).json({ message: 'Gagal mengambil absensi hari ini' });
  }
};

export const getMonthAttendance = async (req, res) => {
  const year = parseInt(req.query.year || '0', 10);
  const month = parseInt(req.query.month || '0', 10);

  if (!(year >= 2000 && month >= 1 && month <= 12)) {
    return res.status(400).json({ message: 'year dan month tidak valid' });
  }

  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  try {
    const [rows] = await aloraMobilePool.query(
      `SELECT attendance_date, clock_in, clock_out, foto_masuk_path, foto_keluar_path,
              clock_in_location_name, clock_out_location_name
       FROM tr_worker_attendance
       WHERE employee_id = ?
         AND attendance_date >= ?
         AND attendance_date < ?
       ORDER BY attendance_date ASC`,
      [req.employeeId, start, end]
    );

    return res.json({
      items: rows.map(serializeAttendance),
    });
  } catch (error) {
    console.error('[attendance] getMonthAttendance', error);
    return res.status(500).json({ message: 'Gagal mengambil absensi bulan ini' });
  }
};

export const getAbsenLocation = async (req, res) => {
  try {
    const office = await getHoLocation();
    if (!office) {
      return res.status(500).json({ message: 'Lokasi absensi HO-ALR belum tersedia' });
    }
    return res.json({
      location_id: office.location_id,
      location_name: office.location_name,
      latitude: Number(office.latitude),
      longitude: Number(office.longitude),
      radius_km: ABSEN_RADIUS_KM,
    });
  } catch (error) {
    console.error('[attendance] getAbsenLocation', error);
    return res.status(500).json({ message: 'Gagal mengambil lokasi absensi' });
  }
};

export const serveAttendanceFile = (req, res) => {
  const safeFileName = path.basename(req.params.filename);
  const fullPath = path.join(ATTENDANCE_BASE, safeFileName);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ message: 'File absensi tidak ditemukan' });
  }

  return res.sendFile(fullPath);
};

export const checkInAttendance = async (req, res) => {
  const employeeId = req.employeeId;
  const today = todayDateString();

  try {
    await assertNotLockedByApprovedFullDayLeave(employeeId);

    if (!req.file) {
      return res.status(422).json({ message: 'Foto masuk wajib dilampirkan' });
    }

    const { office, lat, lng, locationName, insideRadius } = await resolvePunchLocation(
      req.body.latitude,
      req.body.longitude
    );
    const locationAbsenId = insideRadius ? office.id : null;
    const existing = await getTodayRow(employeeId);

    if (existing?.clock_in) {
      return res.status(409).json({ message: 'Anda sudah melakukan absen masuk hari ini' });
    }

    const saved = await savePhoto(employeeId, today, 'foto_masuk', req.file);

    if (!existing) {
      const [result] = await aloraMobilePool.query(
        `INSERT INTO tr_worker_attendance
           (employee_id, attendance_date, clock_in, foto_masuk_path,
            clock_in_latitude, clock_in_longitude, clock_in_location_name, location_absen_id)
         VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)`,
        [employeeId, today, saved.path, lat, lng, locationName, locationAbsenId]
      );
      const [[inserted]] = await aloraMobilePool.query(
        'SELECT * FROM tr_worker_attendance WHERE id = ?',
        [result.insertId]
      );
      return res.status(201).json({
        message: 'Absen masuk berhasil',
        attendance: serializeAttendance(inserted),
      });
    }

    await aloraMobilePool.query(
      `UPDATE tr_worker_attendance
       SET clock_in = NOW(),
           foto_masuk_path = ?,
           clock_in_latitude = ?,
           clock_in_longitude = ?,
           clock_in_location_name = ?,
           location_absen_id = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [saved.path, lat, lng, locationName, locationAbsenId, existing.id]
    );
    const [[updated]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_attendance WHERE id = ?',
      [existing.id]
    );
    return res.status(201).json({
      message: 'Absen masuk berhasil',
      attendance: serializeAttendance(updated),
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error('[attendance] checkInAttendance', error);
    return res.status(status).json({ message: error.message || 'Gagal absen masuk' });
  }
};

export const checkOutAttendance = async (req, res) => {
  const employeeId = req.employeeId;
  const today = todayDateString();

  try {
    await assertNotLockedByApprovedFullDayLeave(employeeId);

    if (!req.file) {
      return res.status(422).json({ message: 'Foto keluar wajib dilampirkan' });
    }

    const { lat, lng, locationName } = await resolvePunchLocation(
      req.body.latitude,
      req.body.longitude
    );
    const existing = await getTodayRow(employeeId);

    if (!existing?.clock_in) {
      return res.status(409).json({ message: 'Anda belum absen masuk hari ini' });
    }
    if (existing.clock_out) {
      return res.status(409).json({ message: 'Anda sudah melakukan absen keluar hari ini' });
    }

    const saved = await savePhoto(employeeId, today, 'foto_keluar', req.file);

    await aloraMobilePool.query(
      `UPDATE tr_worker_attendance
       SET clock_out = NOW(),
           foto_keluar_path = ?,
           clock_out_latitude = ?,
           clock_out_longitude = ?,
           clock_out_location_name = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [saved.path, lat, lng, locationName, existing.id]
    );
    const [[updated]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_attendance WHERE id = ?',
      [existing.id]
    );
    return res.status(200).json({
      message: 'Absen keluar berhasil',
      attendance: serializeAttendance(updated),
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error('[attendance] checkOutAttendance', error);
    return res.status(status).json({ message: error.message || 'Gagal absen keluar' });
  }
};

export const deleteCheckInPhoto = async (req, res) => {
  const employeeId = req.employeeId;
  const today = todayDateString();

  try {
    const existing = await getTodayRow(employeeId);
    requireTodayPhotoEdit(existing, today, 'clock_in', 'Absen masuk belum tercatat');

    if (existing.clock_out) {
      const error = new Error('Tidak dapat menghapus absen masuk setelah absen keluar');
      error.statusCode = 409;
      throw error;
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
    const [[updated]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_attendance WHERE id = ?',
      [existing.id]
    );
    return res.status(200).json({
      message: 'Absensi masuk dihapus. Silakan absen ulang.',
      attendance: serializeAttendance(updated),
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error('[attendance] deleteCheckInPhoto', error);
    return res.status(status).json({ message: error.message || 'Gagal menghapus foto masuk' });
  }
};

export const deleteCheckOutPhoto = async (req, res) => {
  const employeeId = req.employeeId;
  const today = todayDateString();

  try {
    const existing = await getTodayRow(employeeId);
    requireTodayPhotoEdit(existing, today, 'clock_out', 'Absen keluar belum tercatat');

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
    const [[updated]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_attendance WHERE id = ?',
      [existing.id]
    );
    return res.status(200).json({
      message: 'Absensi keluar dihapus. Silakan absen ulang.',
      attendance: serializeAttendance(updated),
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error('[attendance] deleteCheckOutPhoto', error);
    return res.status(status).json({ message: error.message || 'Gagal menghapus foto keluar' });
  }
};

export const replaceCheckInPhoto = async (req, res) => {
  const employeeId = req.employeeId;
  const today = todayDateString();

  try {
    if (!req.file) {
      return res.status(422).json({ message: 'Foto masuk wajib dilampirkan' });
    }

    const existing = await getTodayRow(employeeId);
    requireTodayPhotoEdit(existing, today, 'clock_in', 'Absen masuk belum tercatat');

    const saved = await savePhoto(employeeId, today, 'foto_masuk', req.file);
    await aloraMobilePool.query(
      `UPDATE tr_worker_attendance
       SET foto_masuk_path = ?, updated_at = NOW()
       WHERE id = ?`,
      [saved.path, existing.id]
    );
    const [[updated]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_attendance WHERE id = ?',
      [existing.id]
    );
    return res.status(200).json({
      message: 'Foto masuk diperbarui',
      attendance: serializeAttendance(updated),
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error('[attendance] replaceCheckInPhoto', error);
    return res.status(status).json({ message: error.message || 'Gagal memperbarui foto masuk' });
  }
};

export const replaceCheckOutPhoto = async (req, res) => {
  const employeeId = req.employeeId;
  const today = todayDateString();

  try {
    if (!req.file) {
      return res.status(422).json({ message: 'Foto keluar wajib dilampirkan' });
    }

    const existing = await getTodayRow(employeeId);
    requireTodayPhotoEdit(existing, today, 'clock_out', 'Absen keluar belum tercatat');

    const saved = await savePhoto(employeeId, today, 'foto_keluar', req.file);
    await aloraMobilePool.query(
      `UPDATE tr_worker_attendance
       SET foto_keluar_path = ?, updated_at = NOW()
       WHERE id = ?`,
      [saved.path, existing.id]
    );
    const [[updated]] = await aloraMobilePool.query(
      'SELECT * FROM tr_worker_attendance WHERE id = ?',
      [existing.id]
    );
    return res.status(200).json({
      message: 'Foto keluar diperbarui',
      attendance: serializeAttendance(updated),
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error('[attendance] replaceCheckOutPhoto', error);
    return res.status(status).json({ message: error.message || 'Gagal memperbarui foto keluar' });
  }
};
