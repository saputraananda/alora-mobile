import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';

const userIcon = (accent) =>
  L.divIcon({
    className: 'tracking-marker',
    html: `<div class="bugar-loc-pulse" style="--bugar-accent:${accent}"><span class="bugar-loc-dot"></span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

function MapController({ focus, following }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.8 });
  }, [focus?.lat, focus?.lng, following, map]);
  return null;
}

export default function BugarTrackingMap({
  points,
  userLocation,
  accentColor,
  following,
  locating,
  onLocate,
}) {
  const trailEnd = points.length > 0 ? points[points.length - 1] : null;
  const focus = userLocation ?? (trailEnd ? { lat: trailEnd.lat, lng: trailEnd.lng } : null);
  const center = focus ? [focus.lat, focus.lng] : [-6.2, 106.816666];
  const latLngs = points.map((p) => [p.lat, p.lng]);
  const markerPos = userLocation ?? (trailEnd ? { lat: trailEnd.lat, lng: trailEnd.lng } : null);

  return (
    <div className="bugar-map border border-slate-200">
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        {latLngs.length > 1 && (
          <Polyline
            positions={latLngs}
            pathOptions={{ color: accentColor, weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
          />
        )}
        {markerPos && (
          <>
            <CircleMarker
              center={[markerPos.lat, markerPos.lng]}
              radius={18}
              pathOptions={{ color: accentColor, fillColor: accentColor, fillOpacity: 0.15, weight: 0 }}
            />
            <Marker position={[markerPos.lat, markerPos.lng]} icon={userIcon(accentColor)} />
          </>
        )}
        <MapController focus={focus} following={following} />
      </MapContainer>

      <button
        type="button"
        className="bugar-map-locate"
        onClick={onLocate}
        disabled={locating}
        aria-label="Ambil lokasi perangkat"
        title="Ambil lokasi saya"
      >
        {locating ? (
          <span className="w-[18px] h-[18px] border-[2.5px] border-slate-200 border-t-navy-950 rounded-full animate-spin" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="8" />
          </svg>
        )}
      </button>
    </div>
  );
}
