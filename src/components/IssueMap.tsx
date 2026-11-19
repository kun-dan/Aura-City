import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import type { Issue } from '../lib/types';
import { DEFAULT_CENTER, STATUS_META, inr } from '../lib/rules';

const iconCache = new Map<string, L.DivIcon>();
function pinIcon(color: string, pulse = false) {
  const key = color + pulse;
  if (!iconCache.has(key))
    iconCache.set(
      key,
      L.divIcon({
        className: 'pin-wrap',
        html: `<div class="pin${pulse ? ' pulse' : ''}" style="--c:${color}"></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
        popupAnchor: [0, -24],
      }),
    );
  return iconCache.get(key)!;
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

function FitTo({ center }: { center?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, Math.max(map.getZoom(), 15));
  }, [center, map]);
  return null;
}

export function IssueMap({ issues, height = '100%', focus }: { issues: Issue[]; height?: string; focus?: [number, number] }) {
  const visible = useMemo(() => issues.filter((i) => i.status !== 'invalid'), [issues]);
  return (
    <MapContainer center={focus ?? DEFAULT_CENTER} zoom={13} style={{ height, width: '100%' }} scrollWheelZoom>
      <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
      <FitTo center={focus} />
      {visible.map((i) => (
        <Marker key={i.id} position={[i.lat, i.lng]} icon={pinIcon(STATUS_META[i.status].color, i.status === 'pending_audit' || i.status === 'classifying')}>
          <Popup>
            <div className="popup">
              <img src={i.before_photo_url} alt="" />
              <strong>{i.category ?? 'New report'}</strong>
              <span style={{ color: STATUS_META[i.status].color, fontWeight: 600 }}>{STATUS_META[i.status].label}</span>
              <span>▲ {i.upvotes} · {inr(i.bounty)}</span>
              <Link to={`/issue/${i.id}`}>Open details →</Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function Picker({ value, onChange }: { value: [number, number]; onChange: (v: [number, number]) => void }) {
  useMapEvents({ click: (e) => onChange([e.latlng.lat, e.latlng.lng]) });
  return (
    <Marker
      position={value}
      draggable
      icon={pinIcon('#7c5cff')}
      eventHandlers={{ dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onChange([ll.lat, ll.lng]); } }}
    />
  );
}

export function LocationPicker({ value, onChange }: { value: [number, number]; onChange: (v: [number, number]) => void }) {
  return (
    <MapContainer center={value} zoom={16} style={{ height: 260, width: '100%' }}>
      <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
      <FitTo center={value} />
      <Picker value={value} onChange={onChange} />
    </MapContainer>
  );
}

export function MapLegend() {
  const keys = ['classifying', 'assigned', 'pending_audit', 'verified'] as const;
  return (
    <div className="legend">
      {keys.map((k) => (
        <span key={k}><i style={{ background: STATUS_META[k].color }} />{STATUS_META[k].label}</span>
      ))}
    </div>
  );
}
