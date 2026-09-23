import { haversineKm } from './bugarGeo.js'
import { avgSpeedKmh, paceMinPerKm } from './bugarCalories.js'

export const PACE_WINDOW_SEC = 6
export const PACE_SAMPLE_KEEP_SEC = 15
export const PACE_MIN_DT_SEC = 2
export const PACE_MIN_DIST_KM = 0.003
export const IDLE_SPEED_KMH = 1.0
export const DECAY_STEP_PACE = 1.5
export const MAX_PACE_BEFORE_EMPTY = 18
export const DECAY_STEP_SPEED = 1.5
export const MIN_SPEED_BEFORE_EMPTY = 0.5
export const PACE_FIX_MAX_ACCURACY = 50

export function windowStatsFromSamples(samples, windowSec = PACE_WINDOW_SEC) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return { distKm: 0, dtSec: 0, speedKmh: 0, liveValid: false }
  }

  const last = samples[samples.length - 1]
  const tLast = last.t
  const windowMs = windowSec * 1000
  let startIdx = samples.length - 1

  for (let i = samples.length - 2; i >= 0; i--) {
    if (tLast - samples[i].t > windowMs) break
    startIdx = i
  }

  const windowSamples = samples.slice(startIdx)
  if (windowSamples.length < 2) {
    return { distKm: 0, dtSec: 0, speedKmh: 0, liveValid: false }
  }

  let distKm = 0
  for (let i = 1; i < windowSamples.length; i++) {
    distKm += haversineKm(windowSamples[i - 1], windowSamples[i])
  }

  const dtSec = Math.max(
    0.001,
    (windowSamples[windowSamples.length - 1].t - windowSamples[0].t) / 1000,
  )
  const speedKmh = avgSpeedKmh(distKm, dtSec)
  const liveValid =
    windowSamples.length >= 2 &&
    dtSec >= PACE_MIN_DT_SEC &&
    distKm >= PACE_MIN_DIST_KM

  return { distKm, dtSec, speedKmh, liveValid }
}

export function tickLivePaceMinPerKm({ samples, previous }) {
  const stats = windowStatsFromSamples(samples)
  if (stats.liveValid && stats.speedKmh >= IDLE_SPEED_KMH) {
    return paceMinPerKm(stats.distKm, stats.dtSec)
  }
  if (previous > 0) {
    const next = previous + DECAY_STEP_PACE
    if (next >= MAX_PACE_BEFORE_EMPTY) return 0
    return next
  }
  return 0
}

export function tickLiveSpeedKmh({ samples, previous }) {
  const stats = windowStatsFromSamples(samples)
  if (stats.liveValid && stats.speedKmh >= IDLE_SPEED_KMH) {
    return stats.speedKmh
  }
  if (previous > 0) {
    const next = previous - DECAY_STEP_SPEED
    if (next < MIN_SPEED_BEFORE_EMPTY) return 0
    return next
  }
  return 0
}
