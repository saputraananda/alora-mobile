import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import { aloraMobilePool, mainPool } from '../db/pool.js';
import { getBaseUploadDir } from '../middleware/upload.js';
import { todayDateStringJakarta } from '../utils/workScheduleRules.js';
import {
  SESSION_TYPES,
  assertCanStartEarnedRo,
  assertCanStartLembur,
  assertNoActiveSession,
  buildPeriodRange,
  computeSessionDurationHours,
  resolveSessionFinalStatus,
  sessionStatusLabel,
  validateTodoItems,
} from '../utils/attendanceSessionRules.js';
import { appendOvertimeLedger } from '../utils/ledgerService.js';

const HO_LOCATION_CODE = 'HO-ALR';
const ABSEN_RADIUS_KM = 2;
const INSIDE_LOCATION_LABEL = 'HO Alora';
const OUTSIDE_LOCATION_LABEL = 'Lokasi diluar jangkauan';
const SESSION_BASE = path.join(getBaseUploadDir(), 'attendance-sessions');

if (!fs.existsSync(SESSION_BASE)) fs.mkdirSync(SESSION_BASE, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('File sesi harus berupa gambar'));
  },
});

export const sessionFotoMasukMiddleware = upload.single('foto_masuk');
export const sessionFotoKeluarMiddleware = upload.single('foto_keluar');

async function getRequesterJobContext(employeeId) {
  const [rows] = await mainPool.query(
    `SELECT employee_id, job_level_id, department_id, full_name
     FROM mst_employee WHERE employee_id = ? AND is_deleted = 0 LIMIT 1`,
    [employeeId]
  );
  return rows[0] || null;
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

async function getHoLocation() {
  const [[row]] = await aloraMobilePool.query(
    `SELECT id, latitude, longitude FROM mst_location_absen WHERE location_id = ? LIMIT 1`,
    [HO_LOCATION_CODE]
  );
  return row || null;
}

async function resolvePunchLocation(latitude, longitude) {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  if (lat === null || lng === null) {
    const error = new Error('Koordinat GPS tidak valid');
    error.statusCode = 400;
    throw error;
  }
  const office = await getHoLocation();
  let insideRadius = false;
  let locationName = OUTSIDE_LOCATION_LABEL;
  if (office) {
    const km = distanceKm(lat, lng, Number(office.latitude), Number(office.longitude));
    insideRadius = km <= ABSEN_RADIUS_KM;
    locationName = insideRadius ? INSIDE_LOCATION_LABEL : OUTSIDE_LOCATION_LABEL;
  }
  return { lat, lng, locationName, insideRadius };
}

async function compressToJpg(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

function sessionPhotoFileName(employeeId, workDate, sessionType, fieldName) {
  return `${employeeId}_${workDate}_${sessionType}_${fieldName}.jpg`;
}

async function saveSessionPhoto(employeeId, workDate, sessionType, fieldName, file) {
  const fileName = sessionPhotoFileName(employeeId, workDate, sessionType, fieldName);
  const filePath = path.join(SESSION_BASE, fileName);
  const buffer = await compressToJpg(file.buffer);
  fs.writeFileSync(filePath, buffer);
  return {
    file: fileName,
    path: `/api/attendance-sessions/file/${fileName}`,
  };
}

function serializeSession(row) {
  if (!row) return null;
  let todoItems = row.todo_items;
  if (typeof todoItems === 'string') {
    try { todoItems = JSON.parse(todoItems); } catch { todoItems = []; }
  }
  return {
    ...row,
    work_date: toDateOnly(row.work_date),
    duration_hours: row.duration_hours != null ? Number(row.duration_hours) : null,
    todo_items: todoItems,
    status_label: sessionStatusLabel(row.status),
    clock_in_inside_radius: row.clock_in_inside_radius != null ? Boolean(row.clock_in_inside_radius) : null,
    clock_out_inside_radius: row.clock_out_inside_radius != null ? Boolean(row.clock_out_inside_radius) : null,
  };
}

export const serveSessionFile = (req, res) => {
  const safeFileName = path.basename(req.params.filename);
  const fullPath = path.join(SESSION_BASE, safeFileName);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ message: 'File sesi tidak ditemukan' });
  }
  return res.sendFile(fullPath);
};

export const listSessions = async (req, res) => {
  const employeeId = req.employeeId;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const offset = (page - 1) * limit;
  const month = parseInt(req.query.month || '0', 10);
  const year = parseInt(req.query.year || '0', 10);
  const sessionType = String(req.query.session_type || '').trim();

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
    if (sessionType === SESSION_TYPES.LEMBUR || sessionType === SESSION_TYPES.EARNED_RO) {
      typeWhere = ' AND session_type = ?';
      typeParams.push(sessionType);
    }

    const [[{ total }]] = await aloraMobilePool.query(
      `SELECT COUNT(*) AS total FROM tr_attendance_sessions
       WHERE employee_id = ?${periodWhere}${typeWhere}`,
      [employeeId, ...periodParams, ...typeParams]
    );

    const [rows] = await aloraMobilePool.query(
      `SELECT * FROM tr_attendance_sessions
       WHERE employee_id = ?${periodWhere}${typeWhere}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [employeeId, ...periodParams, ...typeParams, limit, offset]
    );

    return res.json({
      total: Number(total) || 0,
      page,
      limit,
      items: rows.map(serializeSession),
    });
  } catch (error) {
    console.error('[attendanceSession] listSessions', error);
    return res.status(500).json({ message: 'Gagal mengambil riwayat sesi' });
  }
};

export const getActiveSession = async (req, res) => {
  const today = todayDateStringJakarta();
  try {
    const [[row]] = await aloraMobilePool.query(
      `SELECT * FROM tr_attendance_sessions
       WHERE employee_id = ? AND work_date = ? AND status = 'in_progress' LIMIT 1`,
      [req.employeeId, today]
    );
    return res.json({ session: serializeSession(row) });
  } catch (error) {
    console.error('[attendanceSession] getActiveSession', error);
    return res.status(500).json({ message: 'Gagal mengambil sesi aktif' });
  }
};

async function startSessionCheckIn(req, res, sessionType) {
  const employeeId = req.employeeId;
  const today = todayDateStringJakarta();

  if (!req.file) {
    return res.status(422).json({ message: 'Foto masuk wajib dilampirkan' });
  }

  try {
    await assertNoActiveSession(employeeId, today);

    if (sessionType === SESSION_TYPES.LEMBUR) {
      await assertCanStartLembur(employeeId, today);
    } else {
      await assertCanStartEarnedRo(today);
    }

    const reason = String(req.body.reason || '').trim().slice(0, 1000);
    if (sessionType === SESSION_TYPES.EARNED_RO && !reason) {
      return res.status(422).json({ message: 'Alasan bekerja di hari libur wajib diisi' });
    }

    const job = await getRequesterJobContext(employeeId);
    const { lat, lng, locationName, insideRadius } = await resolvePunchLocation(
      req.body.latitude,
      req.body.longitude
    );
    const saved = await saveSessionPhoto(employeeId, today, sessionType, 'foto_masuk', req.file);

    const [result] = await aloraMobilePool.query(
      `INSERT INTO tr_attendance_sessions
         (employee_id, session_type, work_date, clock_in, foto_masuk_path,
          clock_in_latitude, clock_in_longitude, clock_in_location_name, clock_in_inside_radius,
          reason, status, department_id)
       VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, 'in_progress', ?)`,
      [
        employeeId, sessionType, today, saved.path,
        lat, lng, locationName, insideRadius ? 1 : 0,
        reason || null, job?.department_id || null,
      ]
    );

    const [[inserted]] = await aloraMobilePool.query(
      'SELECT * FROM tr_attendance_sessions WHERE id = ?',
      [result.insertId]
    );
    return res.status(201).json({
      message: 'Clock in sesi berhasil',
      session: serializeSession(inserted),
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error('[attendanceSession] checkIn', error);
    return res.status(status).json({ message: error.message || 'Gagal clock in sesi' });
  }
}

async function finishSessionCheckOut(req, res, sessionType) {
  const employeeId = req.employeeId;
  const today = todayDateStringJakarta();

  if (!req.file) {
    return res.status(422).json({ message: 'Foto keluar wajib dilampirkan' });
  }

  const todoValidated = validateTodoItems(req.body.todo_items);
  if (todoValidated.error) {
    return res.status(422).json({ message: todoValidated.error });
  }

  try {
    const [[session]] = await aloraMobilePool.query(
      `SELECT * FROM tr_attendance_sessions
       WHERE employee_id = ? AND work_date = ? AND session_type = ? AND status = 'in_progress'
       LIMIT 1`,
      [employeeId, today, sessionType]
    );
    if (!session) {
      return res.status(409).json({ message: 'Tidak ada sesi aktif untuk clock out' });
    }

    const job = await getRequesterJobContext(employeeId);
    const { lat, lng, locationName, insideRadius } = await resolvePunchLocation(
      req.body.latitude,
      req.body.longitude
    );
    const saved = await saveSessionPhoto(employeeId, today, sessionType, 'foto_keluar', req.file);

    const clockOutNow = new Date();
    const duration = computeSessionDurationHours(session.clock_in, clockOutNow);
    if (duration.error) {
      return res.status(400).json({ message: duration.error });
    }

    const finalStatus = resolveSessionFinalStatus(job?.job_level_id, sessionType);
    const approvedNow = finalStatus === 'disetujui';

    await aloraMobilePool.query(
      `UPDATE tr_attendance_sessions SET
         clock_out = NOW(),
         foto_keluar_path = ?,
         clock_out_latitude = ?,
         clock_out_longitude = ?,
         clock_out_location_name = ?,
         clock_out_inside_radius = ?,
         duration_hours = ?,
         todo_items = ?,
         status = ?,
         approved_by = ?,
         approved_by_name = ?,
         approved_at = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [
        saved.path, lat, lng, locationName, insideRadius ? 1 : 0,
        duration.durationHours,
        JSON.stringify(todoValidated.items),
        finalStatus,
        approvedNow ? job?.employee_id : null,
        approvedNow ? job?.full_name : null,
        approvedNow ? clockOutNow : null,
        session.id,
      ]
    );

    if (approvedNow && sessionType === SESSION_TYPES.LEMBUR) {
      await appendOvertimeLedger({
        employeeId,
        sessionId: session.id,
        mutationType: 'earned',
        hours: duration.durationHours,
        note: `Lembur auto-approve ${today}`,
      });
    }

    const [[updated]] = await aloraMobilePool.query(
      'SELECT * FROM tr_attendance_sessions WHERE id = ?',
      [session.id]
    );
    return res.status(200).json({
      message: 'Clock out sesi berhasil',
      session: serializeSession(updated),
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error('[attendanceSession] checkOut', error);
    return res.status(status).json({ message: error.message || 'Gagal clock out sesi' });
  }
}

export const lemburCheckIn = (req, res) => startSessionCheckIn(req, res, SESSION_TYPES.LEMBUR);
export const lemburCheckOut = (req, res) => finishSessionCheckOut(req, res, SESSION_TYPES.LEMBUR);
export const earnedRoCheckIn = (req, res) => startSessionCheckIn(req, res, SESSION_TYPES.EARNED_RO);
export const earnedRoCheckOut = (req, res) => finishSessionCheckOut(req, res, SESSION_TYPES.EARNED_RO);
