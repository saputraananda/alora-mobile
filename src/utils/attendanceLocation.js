export const INSIDE_LOCATION_LABEL = 'HO Alora';
export const OUTSIDE_LOCATION_LABEL = 'Lokasi diluar jangkauan';
export const UNRECORDED_LOCATION_LABEL = 'Lokasi belum tercatat';
export const DEFAULT_ABSEN_RADIUS_KM = 2;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function distanceKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function resolveAttendanceLocationLabel(
  workerLat,
  workerLng,
  locations,
  radiusKm = DEFAULT_ABSEN_RADIUS_KM
) {
  const lat = Number(workerLat);
  const lng = Number(workerLng);
  const radius = Number(radiusKm);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(radius) ||
    !Array.isArray(locations) ||
    locations.length === 0
  ) {
    return null;
  }

  let match = null;
  let matchKm = Infinity;
  for (const location of locations) {
    const oLat = Number(location.latitude);
    const oLng = Number(location.longitude);
    if (!Number.isFinite(oLat) || !Number.isFinite(oLng)) continue;
    const km = distanceKm(lat, lng, oLat, oLng);
    if (km <= radius && km < matchKm) {
      match = location;
      matchKm = km;
    }
  }

  return match ? match.location_name : OUTSIDE_LOCATION_LABEL;
}
