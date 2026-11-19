// Web preview fallback: an iframe running the same Leaflet map.
import { createElement, useMemo } from 'react';
import { View } from 'react-native';
import { STATUS_META, DEFAULT_REGION } from '../lib/rules';
import { LEAFLET_CSS, LEAFLET_JS } from '../vendor/leaflet';

export function LeafletMap({ issues = [], focus, picker, style }) {
  const pins = issues.filter((i) => i.status !== 'invalid').map((i) => [i.lat, i.lng, STATUS_META[i.status].color]);
  const c = focus ?? (picker ? [picker.lat, picker.lng] : [DEFAULT_REGION.latitude, DEFAULT_REGION.longitude]);
  const doc = useMemo(
    () => `<!doctype html><html><head><style>${LEAFLET_CSS}</style><script>${LEAFLET_JS}</script><style>html,body,#m{margin:0;height:100%;background:#0b1020}.leaflet-tile-pane{filter:invert(100%) hue-rotate(185deg) brightness(92%) contrast(88%) saturate(80%)}</style></head><body><div id="m"></div><script>var m=L.map('m',{zoomControl:false}).setView([${c[0]},${c[1]}],${focus || picker ? 16 : 13});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(m);${JSON.stringify(pins)}.forEach(function(p){L.circleMarker([p[0],p[1]],{radius:9,color:'#fff',weight:3,fillColor:p[2],fillOpacity:1}).addTo(m)});</script></body></html>`,
    [JSON.stringify(pins), c[0], c[1]], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#0b1020' }, style]}>
      {createElement('iframe', { srcDoc: doc, style: { border: 0, width: '100%', height: '100%' }, title: 'map' })}
    </View>
  );
}
