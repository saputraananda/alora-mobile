const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const store = new Map();

function purgeExpired() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

export function setChallenge(challenge, payload) {
  purgeExpired();
  store.set(challenge, {
    ...payload,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
}

export function consumeChallenge(challenge, expectedType, expectedUserId = null) {
  purgeExpired();
  const entry = store.get(challenge);
  if (!entry) return null;
  store.delete(challenge);
  if (entry.expiresAt <= Date.now()) return null;
  if (entry.type !== expectedType) return null;
  if (expectedUserId != null && entry.userId !== expectedUserId) return null;
  return entry;
}
