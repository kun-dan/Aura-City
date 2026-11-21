import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { DEFAULT_REGION, POINTS_VALID_REPORT, inr } from '../lib/rules';
import { useLookups } from '../state/auth';
import { LeafletMap } from '../components/LeafletMap';
import { PhotoField } from '../components/PhotoField';
import { Glass } from '../components/Glass';
import { Badge, Button, Card, ErrorText, Screen } from '../components/ui';
import { colors, font } from '../theme';

export default function ReportScreen() {
  const lookups = useLookups();
  const [photo, setPhoto] = useState(null);
  const [pos, setPos] = useState({ lat: DEFAULT_REGION.latitude, lng: DEFAULT_REGION.longitude });
  const [locMsg, setLocMsg] = useState('Finding your location…');
  const [note, setNote] = useState('');
  const [address, setAddress] = useState('');
  const [phase, setPhase] = useState('form');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const locate = async () => {
    try {
      setLocMsg('Finding your location…');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return setLocMsg('Location off. Tap the map to place the pin.');
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
      setLocMsg('Using your location. Drag the pin or tap to adjust.');
      try {
        const [g] = await Location.reverseGeocodeAsync({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        if (g && !address) setAddress([g.name, g.street, g.district || g.city].filter(Boolean).slice(0, 2).join(', '));
      } catch {}
    } catch {
      setLocMsg('Could not get location. Tap the map to place the pin.');
    }
  };
  useEffect(() => {
    locate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setError(null);
    setPhase('classifying');
    try {
      setResult(await api.reportIssue({ photoUri: photo, lat: pos.lat, lng: pos.lng, description: note.trim(), address: address.trim() }));
      setPhase('done');
    } catch (e) {
      setError(e.message);
      setPhase('form');
    }
  };
  const reset = () => {
    setPhoto(null);
    setNote('');
    setResult(null);
    setPhase('form');
  };

  if (phase === 'classifying')
    return (
      <Screen title="Report" subtitle="Vision AI">
        <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Glass radius={30} tint={colors.primary} style={styles.scan}>
            <Ionicons name="sparkles" size={34} color="#fff" />
          </Glass>
          <Text style={font.title}>Looking at your photo…</Text>
          <Text style={[font.sub, { textAlign: 'center' }]}>Finding the issue type, the right department and a short summary. This takes a few seconds.</Text>
          <ActivityIndicator color={colors.text} />
        </Card>
      </Screen>
    );

  if (phase === 'done' && result) {
    const dept = lookups?.dept(result.department_id);
    const worker = lookups?.person(result.assigned_to);
    return (
      <Screen title="Reported" subtitle="Thank you">
        {result.status === 'invalid' ? (
          <Card>
            <Text style={font.title}>This doesn't look like a civic issue</Text>
            <Text style={font.body}>{result.summary}</Text>
            <Text style={font.sub}>No points this time. Try a clearer photo of the problem.</Text>
          </Card>
        ) : (
          <Card>
            <Glass radius={999} tint="#10b981" style={{ alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>+{POINTS_VALID_REPORT} points</Text>
            </Glass>
            <Text style={font.title}>{result.category}</Text>
            <Badge status={result.status} />
            <Text style={font.body}>{result.summary}</Text>
            <KV k="Department" v={dept?.name} color={dept?.color} />
            <KV k="Severity" v={`${result.severity}/5`} />
            <KV k="AI confidence" v={`${Math.round((result.ai_confidence ?? 0) * 100)}%`} />
            <KV k="Assigned to" v={worker?.full_name ?? 'Waiting for a worker'} />
            <KV k="Repair budget" v={inr(result.bounty)} />
          </Card>
        )}
        <Button title="View issue" icon="open-outline" onPress={() => router.push(`/issue/${result.id}`)} />
        <Button title="Report another" icon="add" variant="plain" onPress={reset} />
      </Screen>
    );
  }

  return (
    <Screen title="Report" subtitle="New civic issue">
      <PhotoField uri={photo} onChange={setPhoto} label="Add a photo of the issue" />
      <Card>
        <Text style={font.headline}>Where is it?</Text>
        <Text style={font.sub}>{locMsg}</Text>
        <LeafletMap picker={pos} onPick={setPos} style={styles.map} />
        <Button title="Use my location" icon="locate" variant="plain" onPress={locate} />
      </Card>
      <Card>
        <Text style={font.headline}>Details (optional)</Text>
        <Glass radius={14} style={{ paddingHorizontal: 14 }}>
          <TextInput value={note} onChangeText={setNote} placeholder="What's wrong? e.g. deep pothole near the bus stop" placeholderTextColor={colors.faint} style={[styles.input, { minHeight: 70 }]} multiline maxLength={500} />
        </Glass>
        <Glass radius={14} style={{ paddingHorizontal: 14 }}>
          <TextInput value={address} onChangeText={setAddress} placeholder="Landmark / address" placeholderTextColor={colors.faint} style={styles.input} maxLength={120} />
        </Glass>
      </Card>
      <ErrorText text={error} />
      <Button title={photo ? 'Submit report' : 'Add a photo to submit'} icon="send" disabled={!photo} onPress={submit} />
    </Screen>
  );
}

export function KV({ k, v, color }) {
  return (
    <View style={styles.kv}>
      <Text style={font.sub}>{k}</Text>
      <Text style={[font.body, { fontWeight: '700', color: color ?? colors.text, flexShrink: 1, textAlign: 'right' }]}>{v ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scan: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  map: { height: 240, borderRadius: 16 },
  input: { color: colors.text, fontSize: 15, paddingVertical: 12, textAlignVertical: 'top' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
