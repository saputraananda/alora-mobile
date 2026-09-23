export function strideLengthM(heightCm) {
  const h = Number(heightCm);
  const cm = Number.isFinite(h) && h >= 100 && h <= 250 ? h : 170;
  return (cm / 100) * 0.415;
}

export function estimateStepsFromDistance(distanceKm, heightCm) {
  const km = Number(distanceKm);
  if (!Number.isFinite(km) || km <= 0) return 0;
  const stride = strideLengthM(heightCm);
  if (stride <= 0) return 0;
  return Math.max(0, Math.round((km * 1000) / stride));
}

export function magnitudeFromAcceleration(acc) {
  if (!acc) return 0;
  const x = acc.x ?? 0;
  const y = acc.y ?? 0;
  const z = acc.z ?? 0;
  return Math.sqrt(x * x + y * y + z * z);
}

export function createStepDetector() {
  let smoothed = null;
  let lastStepAt = 0;
  const minIntervalMs = 300;
  const threshold = 1.1;

  return function detectStep(magnitude, now = Date.now()) {
    if (smoothed == null) {
      smoothed = magnitude;
      return false;
    }
    const delta = Math.abs(magnitude - smoothed);
    smoothed = magnitude * 0.25 + smoothed * 0.75;
    if (delta > threshold && now - lastStepAt > minIntervalMs && magnitude > 8.5) {
      lastStepAt = now;
      return true;
    }
    return false;
  };
}
