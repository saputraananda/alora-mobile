const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const buckets = new Map();

function bucketKey(ip, username) {
  const userPart = String(username || '').trim().toLowerCase();
  return userPart ? `${ip || 'unknown'}:${userPart}` : `${ip || 'unknown'}:face-scan`;
}

export function checkFaceLoginRateLimit(ip, username) {
  const key = bucketKey(ip, username);
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, entry);
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }
  entry.count += 1;
  return true;
}
