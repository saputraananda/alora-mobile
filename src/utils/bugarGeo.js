const R_EARTH_KM = 6371

export function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

function speedLimits(sport) {
  return sport === 'run'
    ? { minSpeed: 1.2, maxSpeed: 25 }
    : { minSpeed: 2.5, maxSpeed: 80 }
}

export function evaluateMovement(lastAccepted, next, sport, accuracy) {
  if (accuracy === undefined || accuracy > 50) {
    return { accepted: false, addedKm: 0, dtSec: 0, reason: 'accuracy' }
  }

  if (!lastAccepted) {
    return { accepted: true, addedKm: 0, dtSec: 0, reason: 'ok' }
  }

  const distKm = haversineKm(lastAccepted, next)
  const distM = distKm * 1000
  const minDist = Math.max(5, accuracy * 0.35)
  if (distM < minDist) {
    return { accepted: false, addedKm: 0, dtSec: 0, reason: 'distance' }
  }

  const dtSecRaw = Math.max(0.001, (next.t - lastAccepted.t) / 1000)
  const speedKmh = (distKm / dtSecRaw) * 3600
  const { minSpeed, maxSpeed } = speedLimits(sport)

  if (speedKmh > maxSpeed) {
    return { accepted: false, addedKm: 0, dtSec: 0, reason: 'speed' }
  }

  const gapOk =
    dtSecRaw > 15 && distM >= Math.max(8, accuracy * 0.4) && speedKmh <= maxSpeed

  if (speedKmh < minSpeed && !gapOk) {
    return { accepted: false, addedKm: 0, dtSec: 0, reason: 'speed' }
  }

  return {
    accepted: true,
    addedKm: distKm,
    dtSec: Math.min(dtSecRaw, 30),
    reason: 'ok',
  }
}

export function downsamplePoints(points, maxPoints = 500) {
  if (points.length <= maxPoints) return points
  if (maxPoints < 2) return points.slice(0, maxPoints)

  const result = [points[0]]
  const inner = maxPoints - 2
  for (let i = 1; i <= inner; i++) {
    const idx = Math.round((i / (inner + 1)) * (points.length - 1))
    result.push(points[idx])
  }
  result.push(points[points.length - 1])
  return result
}
