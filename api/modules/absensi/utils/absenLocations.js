import { aloraMobilePool } from '../../../db/pool.js';

export const ABSEN_RADIUS_KM = 2;
export const HO_LOCATION_CODE = 'HO-ALR';
export const HO_LOCATION_LABEL = 'HO Alora';
export const OUTSIDE_LOCATION_LABEL = 'Lokasi diluar jangkauan';
export const OUTSIDE_NORMAL_LABEL = 'Sedang di luar';
export const OUTSIDE_NOTE_MIN_LENGTH = 5;

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

export function displayLocationName(row) {
  if (row.location_id === HO_LOCATION_CODE) return HO_LOCATION_LABEL;
  return row.location_name || HO_LOCATION_LABEL;
}

export async function getAbsenLocations() {
  const [rows] = await aloraMobilePool.query(
    `SELECT id, location_id, location_name, latitude, longitude, is_office
     FROM mst_location_absen
     ORDER BY id`
  );
  return rows
    .map((row) => ({
      id: row.id,
      location_id: row.location_id,
      location_name: row.location_name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      is_office: Number(row.is_office) === 1,
      display_name: displayLocationName(row),
    }))
    .filter((loc) => Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude));
}

export function findNearestLocation(lat, lng, locations, radiusKm = ABSEN_RADIUS_KM) {
  let best = null;
  for (const location of locations || []) {
    const km = distanceKm(lat, lng, location.latitude, location.longitude);
    if (km <= radiusKm && (!best || km < best.km)) {
      best = { location, km };
    }
  }
  return best;
}
