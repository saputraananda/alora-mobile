import getAloraMobilePrisma from '../db/aloraMobilePrisma.js';
import { mainPool } from '../db/pool.js';

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

function clearHaidFields() {
  return {
    haidActive: false,
    haidStartedAt: null,
    haidDurationDays: null,
    haidEndsAt: null,
    haidSavedGoalFocus: null,
    haidSavedWeeklyTargetKm: null,
    haidCheckDueAt: null,
    haidFollowUpPending: false,
  };
}

async function resolveHaidState(prisma, row) {
  if (!row?.haidActive || !row.haidEndsAt) return row;
  if (Date.now() < new Date(row.haidEndsAt).getTime()) return row;

  const restoredGoal = row.haidSavedGoalFocus ?? row.goalFocus;
  const restoredTarget = row.haidSavedWeeklyTargetKm != null
    ? num(row.haidSavedWeeklyTargetKm)
    : weeklyTargetKmForGoal(restoredGoal);
  const checkDue = new Date(new Date(row.haidEndsAt).getTime() + HAID_FOLLOW_UP_MS);

  return prisma.trWorkerBugarProfile.update({
    where: { employeeId: row.employeeId },
    data: {
      haidActive: false,
      goalFocus: restoredGoal,
      weeklyTargetKm: restoredTarget,
      haidFollowUpPending: true,
      haidCheckDueAt: checkDue,
    },
  });
}

async function applyHaidStart(prisma, employeeId, existing, durationDays) {
  const days = durationDays ?? HAID_DEFAULT_DURATION_DAYS;
  const now = new Date();
  const endsAt = computeHaidEndsAt(now, days);
  const savedGoal = existing.goalFocus;
  const savedTarget = existing.weeklyTargetKm ?? weeklyTargetKmForGoal(savedGoal);
  const haidTarget = haidWeeklyTargetForGoal(savedGoal);

  return prisma.trWorkerBugarProfile.update({
    where: { employeeId },
    data: {
      haidActive: true,
      haidStartedAt: now,
      haidDurationDays: days,
      haidEndsAt: endsAt,
      haidSavedGoalFocus: savedGoal,
      haidSavedWeeklyTargetKm: savedTarget,
      haidFollowUpPending: false,
      haidCheckDueAt: null,
      weeklyTargetKm: haidTarget,
    },
  });
}

async function loadSerializedProfile(prisma, employeeId) {
  let row = await prisma.trWorkerBugarProfile.findUnique({ where: { employeeId } });
  if (row) row = await resolveHaidState(prisma, row);
  const gender = await fetchEmployeeGender(employeeId);
  return serializeProfile(row, { gender });
}

function num(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

async function fetchAvailableMonthsWib(prisma) {
  const rows = await prisma.trWorkerBugarSession.findMany({
    select: { endedAt: true },
  });
  const keys = new Set();
  for (const row of rows) {
    if (row.endedAt) keys.add(toMonthKeyWib(row.endedAt));
  }
  return [...keys].sort((a, b) => b.localeCompare(a));
}

function serializeProfile(row, extras = {}) {
  if (!row) return null;
  const gender = extras.gender ?? null;
  const now = Date.now();
  const followUpDue = !!(
    row.haidFollowUpPending
    && row.haidCheckDueAt
    && now >= new Date(row.haidCheckDueAt).getTime()
  );
  const haidActive = !!(
    row.haidActive
    && row.haidEndsAt
    && now < new Date(row.haidEndsAt).getTime()
  );
  return {
    id: row.id,
    employee_id: row.employeeId,
    goal_focus: row.goalFocus,
    height_cm: num(row.heightCm),
    weight_kg: num(row.weightKg),
    weekly_target_km: num(row.weeklyTargetKm),
    gender,
    haid_eligible: gender === 'P',
    haid_active: haidActive,
    haid_started_at: row.haidStartedAt,
    haid_duration_days: row.haidDurationDays,
    haid_ends_at: row.haidEndsAt,
    haid_follow_up_pending: row.haidFollowUpPending ?? false,
    haid_check_due_at: row.haidCheckDueAt,
    haid_follow_up_due: followUpDue,
    effective_weekly_target_km: num(row.weeklyTargetKm),
    haid_light_tips: gender === 'P' ? HAID_LIGHT_EXERCISE_TIPS : [],
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function serializeSession(row) {
  if (!row) return null;
  const points = Array.isArray(row.pointsJson) ? row.pointsJson : [];
  return {
    id: row.id,
    client_session_id: row.clientSessionId,
    employee_id: row.employeeId,
    employee_name: row.employeeName,
    sport: row.sport,
    goal_focus: row.goalFocus,
    started_at: row.startedAt,
    ended_at: row.endedAt,
    duration_sec: row.durationSec,
    distance_km: num(row.distanceKm),
    calories: row.calories,
    avg_pace_or_speed: num(row.avgPaceOrSpeed),
    step_count: row.stepCount ?? null,
    step_source: row.stepSource ?? null,
    haid_mode: row.haidMode ?? false,
    point_count: row.pointCount,
    points,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
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
    const prisma = getAloraMobilePrisma();
    const profile = await loadSerializedProfile(prisma, req.employeeId);
    return res.json({ profile });
  } catch (error) {
    console.error('[bugar] getBugarProfile', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const putBugarProfile = async (req, res) => {
  try {
    const prisma = getAloraMobilePrisma();
    const existing = await prisma.trWorkerBugarProfile.findUnique({
      where: { employeeId: req.employeeId },
    });

    const data = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'goal_focus')) {
      if (existing?.haidActive) {
        return res.status(400).json({ message: 'Selesaikan mode haid dulu sebelum mengubah fokus' });
      }
      const goal = req.body.goal_focus;
      if (goal !== null && goal !== '' && !GOALS.includes(goal)) {
        return res.status(400).json({ message: 'Fokus tujuan tidak valid' });
      }
      data.goalFocus = goal || null;
      data.weeklyTargetKm = weeklyTargetKmForGoal(data.goalFocus);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'height_cm')) {
      const heightCm = num(req.body.height_cm);
      if (heightCm != null && (heightCm < 100 || heightCm > 250)) {
        return res.status(400).json({ message: 'Tinggi 100–250 cm' });
      }
      data.heightCm = heightCm;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'weight_kg')) {
      const weightKg = num(req.body.weight_kg);
      if (weightKg != null && (weightKg < 30 || weightKg > 250)) {
        return res.status(400).json({ message: 'Berat 30–250 kg' });
      }
      data.weightKg = weightKg;
    }

    const resolvedGoalFocus = data.goalFocus ?? existing?.goalFocus ?? null;

    const row = await prisma.trWorkerBugarProfile.upsert({
      where: { employeeId: req.employeeId },
      create: {
        employeeId: req.employeeId,
        goalFocus: resolvedGoalFocus,
        heightCm: data.heightCm ?? existing?.heightCm ?? null,
        weightKg: data.weightKg ?? existing?.weightKg ?? null,
        weeklyTargetKm: data.weeklyTargetKm ?? weeklyTargetKmForGoal(resolvedGoalFocus),
      },
      update: data,
    });

    const profile = await loadSerializedProfile(prisma, req.employeeId);
    return res.json({ profile });
  } catch (error) {
    console.error('[bugar] putBugarProfile', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const startBugarHaid = async (req, res) => {
  try {
    const prisma = getAloraMobilePrisma();
    const gender = await fetchEmployeeGender(req.employeeId);
    if (gender !== 'P') {
      return res.status(403).json({ message: 'Mode haid hanya untuk perempuan' });
    }

    const existing = await prisma.trWorkerBugarProfile.findUnique({
      where: { employeeId: req.employeeId },
    });
    if (!existing || !isBodyComplete(existing.heightCm, existing.weightKg)) {
      return res.status(400).json({ message: 'Lengkapi profil tubuh terlebih dahulu' });
    }
    if (!existing.goalFocus || !GOALS.includes(existing.goalFocus)) {
      return res.status(400).json({ message: 'Pilih fokus tujuan terlebih dahulu' });
    }

    let resolved = await resolveHaidState(prisma, existing);
    if (resolved.haidActive) {
      return res.status(409).json({ message: 'Mode haid sudah aktif' });
    }

    const rawDays = req.body?.duration_days;
    const durationDays = rawDays == null ? HAID_DEFAULT_DURATION_DAYS : Number(rawDays);
    if (!Number.isInteger(durationDays) || durationDays < HAID_DURATION_MIN || durationDays > HAID_DURATION_MAX) {
      return res.status(400).json({ message: `Durasi haid ${HAID_DURATION_MIN}–${HAID_DURATION_MAX} hari` });
    }

    await applyHaidStart(prisma, req.employeeId, resolved, durationDays);
    const profile = await loadSerializedProfile(prisma, req.employeeId);
    return res.json({ profile });
  } catch (error) {
    console.error('[bugar] startBugarHaid', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const respondBugarHaidFollowUp = async (req, res) => {
  try {
    const prisma = getAloraMobilePrisma();
    const gender = await fetchEmployeeGender(req.employeeId);
    if (gender !== 'P') {
      return res.status(403).json({ message: 'Mode haid hanya untuk perempuan' });
    }

    const existing = await prisma.trWorkerBugarProfile.findUnique({
      where: { employeeId: req.employeeId },
    });
    if (!existing?.haidFollowUpPending) {
      return res.status(400).json({ message: 'Tidak ada konfirmasi haid yang menunggu' });
    }

    const stillOnPeriod = req.body?.still_on_period === true;

    if (stillOnPeriod) {
      const durationDays = existing.haidDurationDays ?? HAID_DEFAULT_DURATION_DAYS;
      await applyHaidStart(prisma, req.employeeId, existing, durationDays);
    } else {
      await prisma.trWorkerBugarProfile.update({
        where: { employeeId: req.employeeId },
        data: clearHaidFields(),
      });
    }

    const profile = await loadSerializedProfile(prisma, req.employeeId);
    return res.json({ profile });
  } catch (error) {
    console.error('[bugar] respondBugarHaidFollowUp', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const stopBugarHaid = async (req, res) => {
  try {
    const prisma = getAloraMobilePrisma();
    const existing = await prisma.trWorkerBugarProfile.findUnique({
      where: { employeeId: req.employeeId },
    });
    if (!existing?.haidActive) {
      return res.status(400).json({ message: 'Mode haid tidak aktif' });
    }

    const restoredGoal = existing.haidSavedGoalFocus ?? existing.goalFocus;
    const restoredTarget = existing.haidSavedWeeklyTargetKm != null
      ? num(existing.haidSavedWeeklyTargetKm)
      : weeklyTargetKmForGoal(restoredGoal);

    await prisma.trWorkerBugarProfile.update({
      where: { employeeId: req.employeeId },
      data: {
        ...clearHaidFields(),
        goalFocus: restoredGoal,
        weeklyTargetKm: restoredTarget,
      },
    });

    const profile = await loadSerializedProfile(prisma, req.employeeId);
    return res.json({ profile });
  } catch (error) {
    console.error('[bugar] stopBugarHaid', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const listBugarSessions = async (req, res) => {
  try {
    const prisma = getAloraMobilePrisma();
    const sport = req.query.sport;
    if (sport && !SPORTS.includes(sport)) {
      return res.status(400).json({ message: 'Jenis olahraga tidak valid' });
    }

    const rows = await prisma.trWorkerBugarSession.findMany({
      where: {
        employeeId: req.employeeId,
        ...(sport ? { sport } : {}),
      },
      orderBy: { endedAt: 'desc' },
      take: 50,
    });

    return res.json({ sessions: rows.map(serializeSession) });
  } catch (error) {
    console.error('[bugar] listBugarSessions', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

export const createBugarSession = async (req, res) => {
  try {
    const prisma = getAloraMobilePrisma();
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

    const profile = await prisma.trWorkerBugarProfile.findUnique({
      where: { employeeId: req.employeeId },
    });
    if (!profile || !isBodyComplete(profile.heightCm, profile.weightKg)) {
      return res.status(400).json({ message: 'Lengkapi tinggi dan berat sebelum menyimpan sesi' });
    }

    const resolvedProfile = await resolveHaidState(prisma, profile);
    const haidActiveNow = !!(
      resolvedProfile.haidActive
      && resolvedProfile.haidEndsAt
      && Date.now() < new Date(resolvedProfile.haidEndsAt).getTime()
    );
    if (haidModeRequested && !haidActiveNow) {
      return res.status(400).json({ message: 'Mode haid tidak aktif' });
    }

    const existing = await prisma.trWorkerBugarSession.findUnique({
      where: { clientSessionId },
    });
    if (existing) {
      if (existing.employeeId !== req.employeeId) {
        return res.status(409).json({ message: 'Sesi sudah tercatat pada akun lain' });
      }
      return res.json({ session: serializeSession(existing) });
    }

    const points = downsamplePoints(body.points);
    const employeeName = typeof body.employee_name === 'string'
      ? body.employee_name.slice(0, 255)
      : null;

    try {
      const row = await prisma.trWorkerBugarSession.create({
        data: {
          clientSessionId,
          employeeId: req.employeeId,
          employeeName,
          sport,
          goalFocus: resolvedProfile.goalFocus,
          startedAt: new Date(body.started_at),
          endedAt: new Date(body.ended_at),
          durationSec,
          distanceKm,
          calories: Math.round(calories),
          avgPaceOrSpeed,
          stepCount,
          stepSource: stepSourceValue,
          haidMode: haidModeRequested && haidActiveNow,
          pointCount: points.length,
          pointsJson: points,
        },
      });
      return res.status(201).json({ session: serializeSession(row) });
    } catch (error) {
      if (error.code === 'P2002') {
        const again = await prisma.trWorkerBugarSession.findUnique({
          where: { clientSessionId },
        });
        if (again && again.employeeId === req.employeeId) {
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
    const prisma = getAloraMobilePrisma();
    const sport = req.query.sport;
    const where = {
      employeeId: req.employeeId,
      endedAt: { gte: weekStartDate() },
    };

    if (sport && sport !== 'all') {
      if (!SPORTS.includes(sport)) {
        return res.status(400).json({ message: 'Jenis olahraga tidak valid' });
      }
      where.sport = sport;
    }

    const start = weekStartDate();
    const sessions = await prisma.trWorkerBugarSession.findMany({ where });

    const weekly = [0, 0, 0, 0, 0, 0, 0];
    let durationSec = 0;
    let calories = 0;
    let totalKm = 0;

    for (const s of sessions) {
      const ended = new Date(s.endedAt);
      if (ended < start) continue;
      const dayIndex = Math.floor((ended.getTime() - start.getTime()) / 86400000);
      const km = num(s.distanceKm) || 0;
      if (dayIndex >= 0 && dayIndex < 7) weekly[dayIndex] += km;
      durationSec += s.durationSec;
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
    const prisma = getAloraMobilePrisma();
    const sortBy = req.query.sort === 'sessions' ? 'sessions' : 'km';
    const { year, month, key: monthKey } = parseMonthQuery(req.query.month);
    const { start, endExclusive } = monthBoundsWib(year, month);

    const grouped = await prisma.trWorkerBugarSession.groupBy({
      by: ['employeeId'],
      where: {
        endedAt: { gte: start, lt: endExclusive },
      },
      _sum: { distanceKm: true },
      _count: { id: true },
      _max: { endedAt: true },
    });

    const entries = [];
    for (const g of grouped) {
      const latest = await prisma.trWorkerBugarSession.findFirst({
        where: { employeeId: g.employeeId, endedAt: g._max.endedAt },
        orderBy: { id: 'desc' },
        select: { employeeName: true },
      });
      entries.push({
        employee_id: g.employeeId,
        employee_name: latest?.employeeName || 'Pegawai',
        total_km: Math.round((num(g._sum.distanceKm) || 0) * 1000) / 1000,
        session_count: g._count.id,
        last_activity_at: g._max.endedAt,
      });
    }

    const sorted = sortLeaderboard(entries, sortBy);
    const idx = sorted.findIndex((e) => e.employee_id === req.employeeId);
    const availableMonths = await fetchAvailableMonthsWib(prisma);

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
