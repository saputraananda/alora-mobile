export function euclideanDistance(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function averageDescriptors(descriptors) {
  if (!descriptors?.length) return null;
  const size = descriptors[0].length;
  const sum = new Array(size).fill(0);
  for (const desc of descriptors) {
    if (desc.length !== size) continue;
    for (let i = 0; i < size; i += 1) sum[i] += desc[i];
  }
  const n = descriptors.length;
  return sum.map((v) => v / n);
}

export function getMaxMatchDistance() {
  const t = Number(process.env.FACE_MATCH_MAX_DISTANCE);
  return Number.isFinite(t) && t > 0 ? t : 0.45;
}

export function getProbeMaxDistance() {
  const t = Number(process.env.FACE_PROBE_MAX_DISTANCE);
  return Number.isFinite(t) && t > 0 ? t : 0.5;
}

export function getMatchGap() {
  const t = Number(process.env.FACE_MATCH_GAP);
  return Number.isFinite(t) && t > 0 ? t : 0.15;
}

export function getLoginSampleCount() {
  const n = Number(process.env.FACE_LOGIN_SAMPLES);
  return Number.isInteger(n) && n >= 2 ? n : 2;
}

export function isFaceMatchByDistance(probe, enrolled, maxDist = getMaxMatchDistance()) {
  return euclideanDistance(probe, enrolled) <= maxDist;
}

export function findBestFaceMatchByDistance(probe, candidates, maxDist = getMaxMatchDistance()) {
  let best = null;
  let second = null;

  for (const candidate of candidates) {
    const distance = euclideanDistance(probe, candidate.enrolled);
    if (distance > maxDist) continue;

    if (!best || distance < best.distance) {
      second = best;
      best = { userId: candidate.userId, distance };
    } else if (!second || distance < second.distance) {
      second = { userId: candidate.userId, distance };
    }
  }

  if (!best) {
    return { match: null };
  }

  const gap = getMatchGap();
  if (second && second.distance - best.distance < gap) {
    return { match: null, ambiguous: true };
  }

  return { match: best };
}

export function verifyLoginProbes(descriptors, candidates) {
  const required = getLoginSampleCount();
  if (!descriptors?.length || descriptors.length !== required) {
    return { ok: false, reason: 'samples', message: 'Login wajah memerlukan 2 sampel verifikasi' };
  }

  const probeMax = getProbeMaxDistance();
  const probeDistance = euclideanDistance(descriptors[0], descriptors[1]);
  if (probeDistance > probeMax) {
    return {
      ok: false,
      reason: 'inconsistent',
      message: 'Verifikasi wajah gagal. Ambil ulang dengan pencahayaan lebih baik.',
    };
  }

  const match1 = findBestFaceMatchByDistance(descriptors[0], candidates);
  if (match1.ambiguous) {
    return {
      ok: false,
      reason: 'ambiguous',
      message: 'Wajah tidak dapat dipastikan. Coba lagi dengan pencahayaan lebih baik.',
    };
  }
  if (!match1.match) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Wajah tidak dikenali',
    };
  }

  const match2 = findBestFaceMatchByDistance(descriptors[1], candidates);
  if (match2.ambiguous) {
    return {
      ok: false,
      reason: 'ambiguous',
      message: 'Wajah tidak dapat dipastikan. Coba lagi dengan pencahayaan lebih baik.',
    };
  }
  if (!match2.match) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Wajah tidak dikenali',
    };
  }

  if (match1.match.userId !== match2.match.userId) {
    return {
      ok: false,
      reason: 'mismatch',
      message: 'Wajah tidak cocok dengan data terdaftar',
    };
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[face] verifyLoginProbes', {
      userId: match1.match.userId,
      dist1: match1.match.distance.toFixed(3),
      dist2: match2.match.distance.toFixed(3),
      probeDist: probeDistance.toFixed(3),
    });
  }

  return {
    ok: true,
    userId: match1.match.userId,
    distances: [match1.match.distance, match2.match.distance],
  };
}

export function verifyEnrollDescriptors(descriptors, maxSpread = 0.55) {
  if (!descriptors || descriptors.length < 2) return { ok: true };
  for (let i = 0; i < descriptors.length; i += 1) {
    for (let j = i + 1; j < descriptors.length; j += 1) {
      if (euclideanDistance(descriptors[i], descriptors[j]) > maxSpread) {
        return {
          ok: false,
          message: 'Sampel wajah tidak konsisten. Pastikan pencahayaan stabil dan wajah Anda sendiri.',
        };
      }
    }
  }
  return { ok: true };
}
