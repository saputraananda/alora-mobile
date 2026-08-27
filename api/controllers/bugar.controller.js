import { aloraMobilePool, mainPool } from '../db/pool.js';

const GOALS = ['diet', 'maintenance'];
const SPORTS = ['run', 'cycle'];
const GOAL_WEEKLY_TARGET_KM = {
  diet: 20,
  maintenance: 12,
};
const HAID_WEEKLY_TARGET_KM = { diet: 10, maintenance: 6 };
const HAID_DURATION_MIN = 3;
const HAID_DURATION_MAX = 7;
const HAID_DEFAULT_DURATION_DAYS = 5;
const HAID_FOLLOW_UP_MS = 7 * 24 * 60 * 60 * 1000;
const HAID_LIGHT_EXERCISE_TIPS = [
  'Jalan santai atau lari pelan (pace rendah)',
  'Sepeda santai, hindari sprint',
  'Durasi disarankan 15–30 menit per sesi',
  'Istirahat jika tubuh lemas — jangan dipaksakan',
];

function weeklyTargetKmForGoal(goalFocus) {
  if (!goalFocus || !Object.prototype.hasOwnProperty.call(GOAL_WEEKLY_TARGET_KM, goalFocus)) {
    return null;
  }
  return GOAL_WEEKLY_TARGET_KM[goalFocus];
}

function haidWeeklyTargetForGoal(goalFocus) {
  if (!goalFocus || !Object.prototype.hasOwnProperty.call(HAID_WEEKLY_TARGET_KM, goalFocus)) {
    return null;
  }
  return HAID_WEEKLY_TARGET_KM[goalFocus];
}

function computeHaidEndsAt(startedAt, durationDays) {
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(start);
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  const day = Number(parts.find((p) => p.type === 'day').value);
  const endUtc = new Date(Date.UTC(year, month - 1, day + durationDays - 1));
  const ey = endUtc.getUTCFullYear();
  const em = String(endUtc.getUTCMonth() + 1).padStart(2, '0');
  const ed = String(endUtc.getUTCDate()).padStart(2, '0');
  return new Date(`${ey}-${em}-${ed}T23:59:59.999+07:00`);
}

async function fetchEmployeeGender(employeeId) {
  try {
    const [rows] = await mainPool.query(
      'SELECT gender FROM mst_employee WHERE employee_id = ? LIMIT 1',
      [employeeId],
    );
    return rows?.[0]?.gender ?? null;
  } catch {
    return null;
  }
}

async function findBugarProfile(employeeId) {
  const [[row]] = await aloraMobilePool.query(
    'SELECT * FROM tr_worker_bugar_profile WHERE employee_id = ? LIMIT 1',
    [employeeId],
  );
  return row ?? null;
}

async function findBugarSessionByClientId(clientSessionId) {
  const [[row]] = await aloraMobilePool.query(
    'SELECT * FROM tr_worker_bugar_session WHERE client_session_id = ? LIMIT 1',
    [clientSessionId],
  );
  return row ?? null;
}

async function resolveHaidState(row) {
  if (!row?.haid_active || !row.haid_ends_at) return row;
  if (Date.now() < new Date(row.haid_ends_at).getTime()) return row;

  const restoredGoal = row.haid_saved_goal_focus ?? row.goal_focus;
  const restoredTarget = row.haid_saved_weekly_target_km != null
    ? num(row.haid_saved_weekly_target_km)
    : weeklyTargetKmForGoal(restoredGoal);
  const checkDue = new Date(new Date(row.haid_ends_at).getTime() + HAID_FOLLOW_UP_MS);

  await aloraMobilePool.query(
    `UPDATE tr_worker_bugar_profile SET
      haid_active = 0,
      goal_focus = ?,
      weekly_target_km = ?,
      haid_follow_up_pending = 1,
      haid_check_due_at = ?
    WHERE employee_id = ?`,
    [restoredGoal, restoredTarget, checkDue, row.employee_id],
  );

  return findBugarProfile(row.employee_id);
}

async function applyHaidStart(employeeId, existing, durationDays) {
  const days = durationDays ?? HAID_DEFAULT_DURATION_DAYS;
  const now = new Date();
  const endsAt = computeHaidEndsAt(now, days);
  const savedGoal = existing.goal_focus;
  const savedTarget = existing.weekly_target_km ?? weeklyTargetKmForGoal(savedGoal);
  const haidTarget = haidWeeklyTargetForGoal(savedGoal);

  await aloraMobilePool.query(
    `UPDATE tr_worker_bugar_profile SET
      haid_active = 1,
      haid_started_at = ?,
      haid_duration_days = ?,
      haid_ends_at = ?,
      haid_saved_goal_focus = ?,
      haid_saved_weekly_target_km = ?,
      haid_follow_up_pending = 0,
      haid_check_due_at = NULL,
      weekly_target_km = ?
    WHERE employee_id = ?`,
    [now, days, endsAt, savedGoal, savedTarget, haidTarget, employeeId],
  );

  return findBugarProfile(employeeId);
}

async function clearHaidFields(employeeId, extra = {}) {
  await aloraMobilePool.query(
    `UPDATE tr_worker_bugar_profile SET
      haid_active = 0,
      haid_started_at = NULL,
      haid_duration_days = NULL,
      haid_ends_at = NULL,
      haid_saved_goal_focus = NULL,
      haid_saved_weekly_target_km = NULL,
      haid_check_due_at = NULL,
      haid_follow_up_pending = 0,
      goal_focus = ?,
      weekly_target_km = ?
    WHERE employee_id = ?`,
    [
      extra.goal_focus ?? null,
      extra.weekly_target_km ?? null,
      employeeId,
    ],
  );
}

async function loadSerializedProfile(employeeId) {
  let row = await findBugarProfile(employeeId);
  if (row) row = await resolveHaidState(row);
  const gender = await fetchEmployeeGender(employeeId);
  return serializeProfile(row, { gender });
}

function num(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bool(value) {
  return value === true || value === 1 || value === '1';
}

function parsePointsJson(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (value && typeof value === 'object') return value;
  return [];
}

function isBodyComplete(heightCm, weightKg) {
  const h = num(heightCm);
  const w = num(weightKg);
  return h >= 100 && h <= 250 && w >= 30 && w <= 250;
}

function downsamplePoints(points, maxPoints = 500) {
  if (!Array.isArray(points)) return [];
  if (points.length <= maxPoints) return points;
  if (maxPoints < 2) return points.slice(0, maxPoints);

  const result = [points[0]];
  const inner = maxPoints - 2;
  for (let i = 1; i <= inner; i++) {
    const idx = Math.round((i / (inner + 1)) * (points.length - 1));
    result.push(points[idx]);
  }
  result.push(points[points.length - 1]);
  return result;
}

function weekStartDate() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return start;
}

const WIB_TZ = 'Asia/Jakarta';
const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function monthKeyFromParts(year, month) {
  return `${year}-${pad2(month)}`;
}

function wibPartsFromDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WIB_TZ,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  return { year, month };
}

function parseMonthQuery(raw) {
  if (typeof raw === 'string' && MONTH_KEY_RE.test(raw)) {
    const [year, month] = raw.split('-').map(Number);
    return { year, month, key: raw };
  }
  const { year, month } = wibPartsFromDate();
  return { year, month, key: monthKeyFromParts(year, month) };
}

function monthBoundsWib(year, month) {
  const start = new Date(`${year}-${pad2(month)}-01T00:00:00+07:00`);
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const endExclusive = new Date(`${nextYear}-${pad2(nextMonth)}-01T00:00:00+07:00`);
  return { start, endExclusive };
}

function toMonthKeyWib(date) {
  const d = date instanceof Date ? date : new Date(date);
  const { year, month } = wibPartsFromDate(d);
  return monthKeyFromParts(year, month);
}

async function fetchAvailableMonthsWib() {
  const [rows] = await aloraMobilePool.query(
    'SELECT ended_at FROM tr_worker_bugar_session',
  );
  const keys = new Set();
  for (const row of rows) {
    if (row.ended_at) keys.add(toMonthKeyWib(row.ended_at));
  }
  return [...keys].sort((a, b) => b.localeCompare(a));
}

function serializeProfile(row, extras = {}) {
  if (!row) return null;
  const gender = extras.gender ?? null;
  const now = Date.now();
  const followUpDue = !!(
    bool(row.haid_follow_up_pending)
    && row.haid_check_due_at
    && now >= new Date(row.haid_check_due_at).getTime()
  );
  const haidActive = !!(
    bool(row.haid_active)
    && row.haid_ends_at
    && now < new Date(row.haid_ends_at).getTime()
  );
  return {
    id: row.id,
    employee_id: row.employee_id,
    goal_focus: row.goal_focus,
    height_cm: num(row.height_cm),
    weight_kg: num(row.weight_kg),
    weekly_target_km: num(row.weekly_target_km),
    gender,
    haid_eligible: gender === 'P',
    haid_active: haidActive,
    haid_started_at: row.haid_started_at,
    haid_duration_days: row.haid_duration_days,
    haid_ends_at: row.haid_ends_at,
    haid_follow_up_pending: bool(row.haid_follow_up_pending),
    haid_check_due_at: row.haid_check_due_at,
    haid_follow_up_due: followUpDue,
    effective_weekly_target_km: num(row.weekly_target_km),
    haid_light_tips: gender === 'P' ? HAID_LIGHT_EXERCISE_TIPS : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function serializeSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    client_session_id: row.client_session_id,
    employee_id: row.employee_id,
    employee_name: row.employee_name,
    sport: row.sport,
    goal_focus: row.goal_focus,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_sec: row.duration_sec,
    distance_km: num(row.distance_km),
    calories: row.calories,
    avg_pace_or_speed: num(row.avg_pace_or_speed),
    step_count: row.step_count ?? null,
    step_source: row.step_source ?? null,
    haid_mode: bool(row.haid_mode),
    point_count: row.point_count,
    points: parsePointsJson(row.points_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function sortLeaderboard(entries, sortBy) {
  return [...entries].sort((a, b) => {
    if (sortBy === 'sessions') {
      if (b.session_count !== a.session_count) return b.session_count - a.session_count;
      return b.total_km - a.total_km;
    }
    if (b.total_km !== a.total_km) return b.total_km - a.total_km;
    return b.session_count - a.session_count;
  });
}

export const getBugarProfile = async (req, res) => {
  try {
    const profile = await loadSerializedProfile(req.employeeId);
    return res.json({ profile });
  } catch (error) {
    console.error('[bugar] getBugarProfile', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const putBugarProfile = async (req, res) => {
  try {
    const existing = await findBugarProfile(req.employeeId);
    const data = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'goal_focus')) {
      if (existing && bool(existing.haid_active)) {
        return res.status(400).json({ message: 'Selesaikan mode haid dulu sebelum mengubah fokus' });
      }
      const goal = req.body.goal_focus;
      if (goal !== null && goal !== '' && !GOALS.includes(goal)) {
        return res.status(400).json({ message: 'Fokus tujuan tidak valid' });
      }
      data.goal_focus = goal || null;
      data.weekly_target_km = weeklyTargetKmForGoal(data.goal_focus);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'height_cm')) {
      const heightCm = num(req.body.height_cm);
      if (heightCm != null && (heightCm < 100 || heightCm > 250)) {
        return res.status(400).json({ message: 'Tinggi 100–250 cm' });
      }
      data.height_cm = heightCm;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'weight_kg')) {
      const weightKg = num(req.body.weight_kg);
      if (weightKg != null && (weightKg < 30 || weightKg > 250)) {
        return res.status(400).json({ message: 'Berat 30–250 kg' });
      }
      data.weight_kg = weightKg;
    }

    const resolvedGoalFocus = data.goal_focus ?? existing?.goal_focus ?? null;

    if (existing) {
      const sets = [];
      const params = [];
      for (const [key, value] of Object.entries(data)) {
        sets.push(`${key} = ?`);
        params.push(value);
      }
      if (sets.length > 0) {
        await aloraMobilePool.query(
          `UPDATE tr_worker_bugar_profile SET ${sets.join(', ')} WHERE employee_id = ?`,
          [...params, req.employeeId],
        );
      }
    } else {
      await aloraMobilePool.query(
        `INSERT INTO tr_worker_bugar_profile
          (employee_id, goal_focus, height_cm, weight_kg, weekly_target_km)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.employeeId,
          resolvedGoalFocus,
          data.height_cm ?? null,
          data.weight_kg ?? null,
          data.weekly_target_km ?? weeklyTargetKmForGoal(resolvedGoalFocus),
        ],
      );
    }

    const profile = await loadSerializedProfile(req.employeeId);
    return res.json({ profile });
  } catch (error) {
    console.error('[bugar] putBugarProfile', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const startBugarHaid = async (req, res) => {
  try {
    const gender = await fetchEmployeeGender(req.employeeId);
    if (gender !== 'P') {
      return res.status(403).json({ message: 'Mode haid hanya untuk perempuan' });
    }

    const existing = await findBugarProfile(req.employeeId);
    if (!existing || !isBodyComplete(existing.height_cm, existing.weight_kg)) {
      return res.status(400).json({ message: 'Lengkapi profil tubuh terlebih dahulu' });
    }
    if (!existing.goal_focus || !GOALS.includes(existing.goal_focus)) {
      return res.status(400).json({ message: 'Pilih fokus tujuan terlebih dahulu' });
    }

    let resolved = await resolveHaidState(existing);
    if (bool(resolved.haid_active)) {
      return res.status(409).json({ message: 'Mode haid sudah aktif' });
    }

    const rawDays = req.body?.duration_days;
    const durationDays = rawDays == null ? HAID_DEFAULT_DURATION_DAYS : Number(rawDays);
    if (!Number.isInteger(durationDays) || durationDays < HAID_DURATION_MIN || durationDays > HAID_DURATION_MAX) {
      return res.status(400).json({ message: `Durasi haid ${HAID_DURATION_MIN}–${HAID_DURATION_MAX} hari` });
    }

    await applyHaidStart(req.employeeId, resolved, durationDays);
    const profile = await loadSerializedProfile(req.employeeId);
    return res.json({ profile });
  } catch (error) {
    console.error('[bugar] startBugarHaid', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const respondBugarHaidFollowUp = async (req, res) => {
  try {
    const gender = await fetchEmployeeGender(req.employeeId);
    if (gender !== 'P') {
      return res.status(403).json({ message: 'Mode haid hanya untuk perempuan' });
    }

    const existing = await findBugarProfile(req.employeeId);
    if (!bool(existing?.haid_follow_up_pending)) {
      return res.status(400).json({ message: 'Tidak ada konfirmasi haid yang menunggu' });
    }

    const stillOnPeriod = req.body?.still_on_period === true;

    if (stillOnPeriod) {
      const durationDays = existing.haid_duration_days ?? HAID_DEFAULT_DURATION_DAYS;
      await applyHaidStart(req.employeeId, existing, durationDays);
    } else {
      await aloraMobilePool.query(
        `UPDATE tr_worker_bugar_profile SET
          haid_active = 0,
          haid_started_at = NULL,
          haid_duration_days = NULL,
          haid_ends_at = NULL,
          haid_saved_goal_focus = NULL,
          haid_saved_weekly_target_km = NULL,
          haid_check_due_at = NULL,
          haid_follow_up_pending = 0
        WHERE employee_id = ?`,
        [req.employeeId],
      );
    }

    const profile = await loadSerializedProfile(req.employeeId);
    return res.json({ profile });
  } catch (error) {
    console.error('[bugar] respondBugarHaidFollowUp', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const stopBugarHaid = async (req, res) => {
  try {
    const existing = await findBugarProfile(req.employeeId);
    if (!bool(existing?.haid_active)) {
      return res.status(400).json({ message: 'Mode haid tidak aktif' });
    }

    const restoredGoal = existing.haid_saved_goal_focus ?? existing.goal_focus;
    const restoredTarget = existing.haid_saved_weekly_target_km != null
      ? num(existing.haid_saved_weekly_target_km)
      : weeklyTargetKmForGoal(restoredGoal);

    await clearHaidFields(req.employeeId, {
      goal_focus: restoredGoal,
      weekly_target_km: restoredTarget,
    });

    const profile = await loadSerializedProfile(req.employeeId);
    return res.json({ profile });
  } catch (error) {
    console.error('[bugar] stopBugarHaid', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const listBugarSessions = async (req, res) => {
  try {
    const sport = req.query.sport;
    if (sport && !SPORTS.includes(sport)) {
      return res.status(400).json({ message: 'Jenis olahraga tidak valid' });
    }

    const params = [req.employeeId];
    let sql = `
      SELECT * FROM tr_worker_bugar_session
      WHERE employee_id = ?
    `;
    if (sport) {
      sql += ' AND sport = ?';
      params.push(sport);
    }
    sql += ' ORDER BY ended_at DESC LIMIT 50';

    const [rows] = await aloraMobilePool.query(sql, params);
    return res.json({ sessions: rows.map(serializeSession) });
  } catch (error) {
    console.error('[bugar] listBugarSessions', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const createBugarSession = async (req, res) => {
  try {
    const body = req.body || {};
    const clientSessionId = String(body.client_session_id || '').trim();
    const sport = body.sport;
    const durationSec = Number(body.duration_sec);
    const distanceKm = num(body.distance_km);
    const calories = Number(body.calories);
    const avgPaceOrSpeed = num(body.avg_pace_or_speed);
    const stepCountRaw = body.step_count;
    const stepSource = typeof body.step_source === 'string' ? body.step_source.trim() : null;
    const haidModeRequested = body.haid_mode === true;

    if (!clientSessionId || clientSessionId.length > 64) {
      return res.status(400).json({ message: 'client_session_id wajib diisi' });
    }
    if (!SPORTS.includes(sport)) {
      return res.status(400).json({ message: 'Jenis olahraga tidak valid' });
    }
    if (!Number.isInteger(durationSec) || durationSec < 1) {
      return res.status(400).json({ message: 'Durasi sesi tidak valid' });
    }
    if (distanceKm == null || distanceKm < 0) {
      return res.status(400).json({ message: 'Jarak sesi tidak valid' });
    }
    if (!Number.isFinite(calories) || calories < 0) {
      return res.status(400).json({ message: 'Kalori tidak valid' });
    }
    if (avgPaceOrSpeed == null || avgPaceOrSpeed < 0) {
      return res.status(400).json({ message: 'Pace/kecepatan tidak valid' });
    }
    if (!body.started_at || !body.ended_at) {
      return res.status(400).json({ message: 'Waktu mulai dan selesai wajib diisi' });
    }
    if (!Array.isArray(body.points)) {
      return res.status(400).json({ message: 'Titik GPS tidak valid' });
    }

    let stepCount = null;
    let stepSourceValue = null;
    if (sport === 'run') {
      const sc = Number(stepCountRaw);
      if (!Number.isInteger(sc) || sc < 0) {
        return res.status(400).json({ message: 'Jumlah langkah tidak valid' });
      }
      if (stepSource !== 'sensor' && stepSource !== 'estimate') {
        return res.status(400).json({ message: 'Sumber langkah tidak valid' });
      }
      stepCount = sc;
      stepSourceValue = stepSource;
    }

    const profile = await findBugarProfile(req.employeeId);
    if (!profile || !isBodyComplete(profile.height_cm, profile.weight_kg)) {
      return res.status(400).json({ message: 'Lengkapi tinggi dan berat sebelum menyimpan sesi' });
    }

    const resolvedProfile = await resolveHaidState(profile);
    const haidActiveNow = !!(
      bool(resolvedProfile.haid_active)
      && resolvedProfile.haid_ends_at
      && Date.now() < new Date(resolvedProfile.haid_ends_at).getTime()
    );
    if (haidModeRequested && !haidActiveNow) {
      return res.status(400).json({ message: 'Mode haid tidak aktif' });
    }

    const existing = await findBugarSessionByClientId(clientSessionId);
    if (existing) {
      if (existing.employee_id !== req.employeeId) {
        return res.status(409).json({ message: 'Sesi sudah tercatat pada akun lain' });
      }
      return res.json({ session: serializeSession(existing) });
    }

    const points = downsamplePoints(body.points);
    const employeeName = typeof body.employee_name === 'string'
      ? body.employee_name.slice(0, 255)
      : null;

    try {
      const [result] = await aloraMobilePool.query(
        `INSERT INTO tr_worker_bugar_session (
          client_session_id, employee_id, employee_name, sport, goal_focus,
          started_at, ended_at, duration_sec, distance_km, calories,
          avg_pace_or_speed, step_count, step_source, haid_mode, point_count, points_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientSessionId,
          req.employeeId,
          employeeName,
          sport,
          resolvedProfile.goal_focus,
          new Date(body.started_at),
          new Date(body.ended_at),
          durationSec,
          distanceKm,
          Math.round(calories),
          avgPaceOrSpeed,
          stepCount,
          stepSourceValue,
          haidModeRequested && haidActiveNow ? 1 : 0,
          points.length,
          JSON.stringify(points),
        ],
      );

      const [[row]] = await aloraMobilePool.query(
        'SELECT * FROM tr_worker_bugar_session WHERE id = ? LIMIT 1',
        [result.insertId],
      );
      return res.status(201).json({ session: serializeSession(row) });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        const again = await findBugarSessionByClientId(clientSessionId);
        if (again && again.employee_id === req.employeeId) {
          return res.json({ session: serializeSession(again) });
        }
        return res.status(409).json({ message: 'Sesi sudah tercatat pada akun lain' });
      }
      throw error;
    }
  } catch (error) {
    console.error('[bugar] createBugarSession', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const getBugarStats = async (req, res) => {
  try {
    const sport = req.query.sport;
    const start = weekStartDate();
    const params = [req.employeeId, start];
    let sql = `
      SELECT * FROM tr_worker_bugar_session
      WHERE employee_id = ? AND ended_at >= ?
    `;

    if (sport && sport !== 'all') {
      if (!SPORTS.includes(sport)) {
        return res.status(400).json({ message: 'Jenis olahraga tidak valid' });
      }
      sql += ' AND sport = ?';
      params.push(sport);
    }

    const [sessions] = await aloraMobilePool.query(sql, params);

    const weekly = [0, 0, 0, 0, 0, 0, 0];
    let durationSec = 0;
    let calories = 0;
    let totalKm = 0;

    for (const s of sessions) {
      const ended = new Date(s.ended_at);
      if (ended < start) continue;
      const dayIndex = Math.floor((ended.getTime() - start.getTime()) / 86400000);
      const km = num(s.distance_km) || 0;
      if (dayIndex >= 0 && dayIndex < 7) weekly[dayIndex] += km;
      durationSec += s.duration_sec;
      calories += s.calories;
      totalKm += km;
    }

    return res.json({
      stats: {
        weekly: weekly.map((v) => Math.round(v * 10) / 10),
        duration_sec: durationSec,
        calories,
        count: sessions.length,
        total_km: Math.round(totalKm * 10) / 10,
      },
    });
  } catch (error) {
    console.error('[bugar] getBugarStats', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const getBugarLeaderboard = async (req, res) => {
  try {
    const sortBy = req.query.sort === 'sessions' ? 'sessions' : 'km';
    const { year, month, key: monthKey } = parseMonthQuery(req.query.month);
    const { start, endExclusive } = monthBoundsWib(year, month);

    const [grouped] = await aloraMobilePool.query(
      `SELECT
        s.employee_id,
        COUNT(*) AS session_count,
        SUM(s.distance_km) AS total_km,
        MAX(s.ended_at) AS last_activity_at,
        (
          SELECT s2.employee_name
          FROM tr_worker_bugar_session s2
          WHERE s2.employee_id = s.employee_id
          ORDER BY s2.ended_at DESC, s2.id DESC
          LIMIT 1
        ) AS employee_name
      FROM tr_worker_bugar_session s
      WHERE s.ended_at >= ? AND s.ended_at < ?
      GROUP BY s.employee_id`,
      [start, endExclusive],
    );

    const entries = grouped.map((g) => ({
      employee_id: g.employee_id,
      employee_name: g.employee_name || 'Pegawai',
      total_km: Math.round((num(g.total_km) || 0) * 1000) / 1000,
      session_count: Number(g.session_count),
      last_activity_at: g.last_activity_at,
    }));

    const sorted = sortLeaderboard(entries, sortBy);
    const idx = sorted.findIndex((e) => e.employee_id === req.employeeId);
    const availableMonths = await fetchAvailableMonthsWib();

    return res.json({
      month: monthKey,
      available_months: availableMonths,
      entries: sorted,
      my_rank: idx >= 0 ? idx + 1 : null,
    });
  } catch (error) {
    console.error('[bugar] getBugarLeaderboard', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};
