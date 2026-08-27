import { haversineKm } from './bugarGeo.js'
import { avgSpeedKmh, paceMinPerKm } from './bugarCalories.js'

export const ROLLING_WINDOW_SEC = 25

export function rollingWindowStats(points, windowSec = ROLLING_WINDOW_SEC) {
  if (!Array.isArray(points) || points.length < 2) {
    return { distKm: 0, dtSec: 0, valid: false }
  }

  const last = points[points.length - 1]
  const tLast = last.t
  const windowMs = windowSec * 1000
  let startIdx = points.length - 1

  for (let i = points.length - 2; i >= 0; i--) {
    if (tLast - points[i].t > windowMs) break
    startIdx = i
  }

  const windowPoints = points.slice(startIdx)
  if (windowPoints.length < 2) {
    return { distKm: 0, dtSec: 0, valid: false }
  }

  let distKm = 0
  for (let i = 1; i < windowPoints.length; i++) {
    distKm += haversineKm(windowPoints[i - 1], windowPoints[i])
  }

  const dtSec = Math.max(0.001, (windowPoints[windowPoints.length - 1].t - windowPoints[0].t) / 1000)
  const valid = windowPoints.length >= 2 && (dtSec >= 8 || distKm >= 0.04)

  return { distKm, dtSec, valid }
}

export function rollingPaceMinPerKm(points) {
  const { distKm, dtSec, valid } = rollingWindowStats(points)
  if (!valid) return 0
  return paceMinPerKm(distKm, dtSec)
}

export function rollingSpeedKmh(points) {
  const { distKm, dtSec, valid } = rollingWindowStats(points)
  if (!valid) return 0
  return avgSpeedKmh(distKm, dtSec)
}
