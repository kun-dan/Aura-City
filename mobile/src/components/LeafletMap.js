// Map rendered with Leaflet + OpenStreetMap inside a WebView: works on Android and iOS without a Google Maps key.
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { STATUS_META, DEFAULT_REGION } from '../lib/rules';
import { LEAFLET_CSS, LEAFLET_JS } from '../vendor/leaflet';

const html = (lat, lng, zoom, picker) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>${LEAFLET_CSS}</style>
<script>${LEAFLET_JS}</script>
<style>
html,body,#map{margin:0;height:100%;background:#0b1020}
.pin{width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.5)}
.pulse{animation:p 1.6s infinite}@keyframes p{0%{box-shadow:0 0 0 0 rgba(245,158,11,.7)}70%{box-shadow:0 0 0 14px rgba(0,0,0,0)}}
.leaflet-control-attribution{font-size:9px;background:rgba(11,16,32,.6)!important;color:#aab}
.leaflet-control-attribution a{color:#ccd}
.leaflet-control-zoom{display:none}
</style></head><body><div id="map"></div><script>
var send=function(o){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(o))};
var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([${lat},${lng}],${zoom});
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19,attribution:'© OpenStreetMap © CARTO'}).addTo(map);
var layer=L.layerGroup().addTo(map);
var icon=function(c,p){return L.divIcon({className:'',html:'<div class="pin'+(p?' pulse':'')+'" style="background:'+c+'"></div>',iconSize:[22,22],iconAnchor:[11,22]})};
window.setIssues=function(list){layer.clearLayers();list.forEach(function(i){L.marker([i.lat,i.lng],{icon:icon(i.color,i.pulse)}).on('click',function(){send({type:'select',id:i.id})}).addTo(layer)})};
window.focusOn=function(lat,lng,z){map.setView([lat,lng],z||16)};
${picker ? `var pick=L.marker([${lat},${lng}],{draggable:true,icon:icon('#8b7bff')}).addTo(map);
var moved=function(ll){pick.setLatLng(ll);send({type:'pick',lat:ll.lat,lng:ll.lng})};
pick.on('dragend',function(){moved(pick.getLatLng())});map.on('click',function(e){moved(e.latlng)});
window.setPick=function(lat,lng){pick.setLatLng([lat,lng]);map.setView([lat,lng],17)};` : ''}
send({type:'ready'});
</script></body></html>`;

export function LeafletMap({ issues = [], onSelect, focus, picker, onPick, style, zoom = 13 }) {
  const ref = useRef(null);
  const readyRef = useRef(false);
  const start = focus ?? (picker ? [picker.lat, picker.lng] : [DEFAULT_REGION.latitude, DEFAULT_REGION.longitude]);
  // The HTML is built once; later updates are injected so the map does not reload.
  const source = useMemo(() => ({ html: html(start[0], start[1], picker || focus ? 16 : zoom, !!picker) }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const payload = JSON.stringify(
    issues
      .filter((i) => i.status !== 'invalid')
      .map((i) => ({ id: i.id, lat: i.lat, lng: i.lng, color: STATUS_META[i.status].color, pulse: i.status === 'pending_audit' || i.status === 'classifying' })),
  );
  const push = () => ref.current?.injectJavaScript(`window.setIssues && window.setIssues(${payload}); true;`);
  useEffect(() => {
    if (readyRef.current) push();
  }, [payload]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickKey = picker ? `${picker.lat.toFixed(6)},${picker.lng.toFixed(6)}` : '';
  const lastSent = useRef('');
  useEffect(() => {
    if (picker && readyRef.current && pickKey !== lastSent.current) {
      ref.current?.injectJavaScript(`window.setPick && window.setPick(${picker.lat}, ${picker.lng}); true;`);
    }
  }, [pickKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={ref}
        source={source}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        style={styles.web}
        overScrollMode="never"
        bounces={false}
        setSupportMultipleWindows={false}
        onMessage={(e) => {
          let msg;
          try {
            msg = JSON.parse(e.nativeEvent.data);
          } catch {
            return;
          }
          if (msg.type === 'ready') {
            readyRef.current = true;
            push();
          } else if (msg.type === 'select') onSelect?.(msg.id);
          else if (msg.type === 'pick') {
            lastSent.current = `${msg.lat.toFixed(6)},${msg.lng.toFixed(6)}`;
            onPick?.({ lat: msg.lat, lng: msg.lng });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#0b1020' },
  web: { flex: 1, backgroundColor: '#0b1020' },
});
