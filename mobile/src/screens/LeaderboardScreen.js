import { StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { POINTS_ISSUE_FIXED, POINTS_VALID_REPORT } from '../lib/rules';
import { useLive, useMe } from '../state/auth';
import { Glass } from '../components/Glass';
import { Card, Screen } from '../components/ui';
import { colors, font } from '../theme';

export default function LeaderboardScreen() {
  const me = useMe();
  const { data = [] } = useLive(() => api.listProfiles());
  const ranked = data.filter((p) => p.role === 'citizen').sort((a, b) => b.points - a.points);
  const rank = ranked.findIndex((p) => p.id === me.id) + 1;
  return (
    <Screen title="Leaders" subtitle="Citizen points">
      <Card tint={colors.primary}>
        <Text style={font.caption}>Your rank</Text>
        <Text style={font.largeTitle}>#{rank || '—'} · {me.points} pts</Text>
        <Text style={font.sub}>+{POINTS_VALID_REPORT} for every valid report, +{POINTS_ISSUE_FIXED} more when it's fixed and verified.</Text>
      </Card>
      <Glass>
        {ranked.map((p, i) => (
          <View key={p.id} style={[styles.row, p.id === me.id && styles.me, i === ranked.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={styles.rank}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</Text>
            <Text style={[font.body, { flex: 1 }]}>{p.full_name}</Text>
            <Text style={[font.headline, font.number]}>{p.points}</Text>
          </View>
        ))}
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  me: { backgroundColor: 'rgba(139,123,255,0.22)' },
  rank: { width: 30, textAlign: 'center', fontSize: 18, color: colors.text, fontWeight: '800' },
});
