import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'react-native';
import { api } from '../lib/api';
import { ACTIVE_STATUSES, STATUS_META, MOODS, inr } from '../lib/rules';
import { photoSource } from '../lib/photos';
import { useLive, useMe } from '../state/auth';
import { LeafletMap } from '../components/LeafletMap';
import { Glass, GlassPressable } from '../components/Glass';
import { Badge, Button, HeaderActions, Segmented } from '../components/ui';
import { colors, font } from '../theme';

export default function MapScreen() {
  const me = useMe();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('active');
  const { data } = useLive(async () => ({ issues: await api.listIssues(), mood: await api.cityMood() }));
  const issues = data?.issues ?? [];

  const shown = useMemo(() => {
    if (filter === 'active') return issues.filter((i) => ACTIVE_STATUSES.includes(i.status) || i.status === 'classifying');
    if (filter === 'fixed') return issues.filter((i) => i.status === 'verified');
    if (filter === 'mine') return issues.filter((i) => i.reporter_id === me.id);
    return issues;
  }, [issues, filter, me.id]);
  const mood = MOODS.find((m) => m.mood === data?.mood.majority);
  const open = (id) => router.push(`/issue/${id}`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LeafletMap issues={shown} onSelect={open} style={StyleSheet.absoluteFill} />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.row} pointerEvents="box-none">
          <Glass radius={22} style={styles.titleCard}>
            <Text style={font.caption}>Prayagraj · live</Text>
            <Text style={font.title}>{mood ? `${mood.emoji} City is ${mood.label.toLowerCase()}` : 'Auracity'}</Text>
          </Glass>
          <HeaderActions />
        </View>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'fixed', label: 'Fixed' },
            { value: 'all', label: 'All' },
            ...(me.role === 'citizen' ? [{ value: 'mine', label: 'Mine' }] : []),
          ]}
        />
        <Glass radius={14} style={styles.legend}>
          {['assigned', 'pending_audit', 'verified'].map((k) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: STATUS_META[k].color }]} />
              <Text style={styles.legendText}>{STATUS_META[k].label}</Text>
            </View>
          ))}
        </Glass>
      </View>

      <View style={styles.bottom} pointerEvents="box-none">
        {me.role === 'citizen' && (
          <Button title="Report issue" icon="camera" onPress={() => router.push('/citizen/report')} style={styles.fab} />
        )}
        <FlatList
          horizontal
          data={shown}
          keyExtractor={(i) => i.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          ListEmptyComponent={<Glass style={{ padding: 16 }}><Text style={font.sub}>Nothing here yet.</Text></Glass>}
          renderItem={({ item }) => (
            <GlassPressable onPress={() => open(item.id)} contentStyle={styles.card}>
              <Image source={photoSource(item.before_photo_url)} style={styles.cardImg} />
              <View style={{ padding: 10, gap: 4 }}>
                <Text style={font.headline} numberOfLines={1}>{item.category ?? 'Classifying…'}</Text>
                <Badge status={item.status} />
                <Text style={font.sub} numberOfLines={1}>▲ {item.upvotes} · {inr(item.bounty)}</Text>
              </View>
            </GlassPressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleCard: { flex: 1, paddingHorizontal: 16, paddingVertical: 10 },
  legend: { flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' },
  legendText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 14, gap: 12 },
  fab: { alignSelf: 'center' },
  card: { width: 210 },
  cardImg: { width: '100%', height: 100, backgroundColor: '#1e293b' },
});
