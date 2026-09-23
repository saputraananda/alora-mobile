export const HAID_DURATION_OPTIONS = [3, 5, 7];
export const HAID_DEFAULT_DURATION_DAYS = 5;
export const HAID_FOLLOW_UP_DAYS = 7;
export const HAID_WEEKLY_TARGET_KM = { diet: 10, maintenance: 6 };
export const HAID_CALORIE_FACTOR = 0.85;
export const HAID_LIGHT_EXERCISE_TIPS = [
  'Jalan santai atau lari pelan (pace rendah)',
  'Sepeda santai, hindari sprint',
  'Durasi disarankan 15–30 menit per sesi',
  'Istirahat jika tubuh lemas — jangan dipaksakan',
];

const WIB_TZ = 'Asia/Jakarta';

function wibDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WIB_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === 'year').value),
    month: Number(parts.find((p) => p.type === 'month').value),
    day: Number(parts.find((p) => p.type === 'day').value),
  };
}

export function weeklyTargetKmForHaid(goalFocus) {
  if (!goalFocus || !Object.prototype.hasOwnProperty.call(HAID_WEEKLY_TARGET_KM, goalFocus)) {
    return null;
  }
  return HAID_WEEKLY_TARGET_KM[goalFocus];
}

export function computeHaidEndsAt(startedAt, durationDays) {
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const { year, month, day } = wibDateParts(start);
  const endUtc = new Date(Date.UTC(year, month - 1, day + durationDays - 1));
  const ey = endUtc.getUTCFullYear();
  const em = String(endUtc.getUTCMonth() + 1).padStart(2, '0');
  const ed = String(endUtc.getUTCDate()).padStart(2, '0');
  return new Date(`${ey}-${em}-${ed}T23:59:59.999+07:00`);
}

export function isHaidPeriodActive(profile) {
  if (!profile?.haid_active || !profile?.haid_ends_at) return false;
  return Date.now() < new Date(profile.haid_ends_at).getTime();
}

export function isHaidFollowUpDue(profile) {
  if (!profile?.haid_follow_up_pending || !profile?.haid_check_due_at) return false;
  return Date.now() >= new Date(profile.haid_check_due_at).getTime();
}

export function daysUntilHaidEnd(profile) {
  if (!profile?.haid_ends_at) return 0;
  const diff = new Date(profile.haid_ends_at).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86400000);
}

export function effectiveWeeklyTargetKm(profile) {
  const effective = profile?.effective_weekly_target_km ?? profile?.weekly_target_km;
  const n = Number(effective);
  return Number.isFinite(n) ? n : 0;
}
