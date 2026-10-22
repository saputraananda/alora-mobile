export const INSIDE_LOCATION_LABEL = 'HO Alora';
export const OUTSIDE_LOCATION_LABEL = 'Lokasi diluar jangkauan';
export const OUTSIDE_NORMAL_LABEL = 'Sedang di luar';
export const UNRECORDED_LOCATION_LABEL = 'Lokasi belum tercatat';
export const DEFAULT_ABSEN_RADIUS_KM = 0.05;
export const DEFAULT_OFFICE_LOCATIONS = [
  { location_name: 'HO Alora', latitude: -6.3983239, longitude: 106.8997063, is_office: true },
  { location_name: 'IKM Pringgondani', latitude: -6.3848079, longitude: 106.8997077, is_office: true },
  { location_name: 'IKM Kebayunan', latitude: -6.402972, longitude: 106.8915943, is_office: true },
];

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
  radiusKm = DEFAULT_ABSEN_RADIUS_KM,
  { officeOnly = false } = {}
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
    if (officeOnly && !location.is_office) continue;
    const oLat = Number(location.latitude);
    const oLng = Number(location.longitude);
    if (!Number.isFinite(oLat) || !Number.isFinite(oLng)) continue;
    const km = distanceKm(lat, lng, oLat, oLng);
    if (km <= radius && km < matchKm) {
      match = location;
      matchKm = km;
    }
  }

  if (match) return match.location_name;
  return officeOnly ? OUTSIDE_NORMAL_LABEL : OUTSIDE_LOCATION_LABEL;
}
