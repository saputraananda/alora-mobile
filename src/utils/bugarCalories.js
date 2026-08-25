import { formatPace, formatSpeed } from './bugarFormat.js'

export { formatPace, formatSpeed }

export function avgSpeedKmh(distanceKm, durationSec) {
  if (distanceKm <= 0 || durationSec <= 0) return 0
  return distanceKm / (durationSec / 3600)
}

export function paceMinPerKm(distanceKm, durationSec) {
  if (distanceKm <= 0 || durationSec <= 0) return 0
  return durationSec / 60 / distanceKm
}

function metForRun(speedKmh) {
  if (speedKmh < 6) return 6.0
  if (speedKmh < 8) return 8.3
  if (speedKmh < 10) return 9.8
  return 11.0
}

function metForCycle(speedKmh) {
  if (speedKmh < 16) return 4.0
  if (speedKmh < 20) return 6.8
  if (speedKmh < 25) return 8.0
  return 10.0
}

export function calcCalories(opts) {
  const { sport, weightKg, distanceKm, durationSec, haidMode } = opts
  if (distanceKm <= 0 || durationSec <= 0 || weightKg <= 0) return 0
  const speed = avgSpeedKmh(distanceKm, durationSec)
  const met = sport === 'run' ? metForRun(speed) : metForCycle(speed)
  let calories = Math.round(met * weightKg * (durationSec / 3600))
  if (haidMode) {
    calories = Math.round(calories * 0.85)
  }
  return calories
}
