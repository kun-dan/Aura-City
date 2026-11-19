import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { MOODS } from '../lib/rules';
import { useLive } from '../state/auth';
import { colors, font } from '../theme';
import { Glass, GlassGroup, GlassPressable } from './Glass';

export function MoodWidget({ canVote }) {
  const { data, reload } = useLive(() => api.cityMood());
  const [busy, setBusy] = useState(false);
  if (!data) return <Glass style={{ height: 120 }} />;
  const top = MOODS.find((m) => m.mood === data.majority);
  const vote = async (mood) => {
    setBusy(true);
    try {
      await api.voteMood(mood);
      await reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Glass style={{ padding: 16, gap: 12 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={font.caption}>City Mood · last 2 hours</Text>
          <Text style={[font.title, { marginTop: 4 }]}>{top ? `${top.emoji}  Mostly ${top.label.toLowerCase()}` : 'No votes yet'}</Text>
        </View>
        <Text style={font.sub}>{data.total} vote{data.total === 1 ? '' : 's'}</Text>
      </View>
      <View style={styles.bar}>
        {MOODS.map((m) => (data.counts[m.mood] ? <View key={m.mood} style={{ flex: data.counts[m.mood], backgroundColor: m.color }} /> : null))}
      </View>
      {canVote && (
        <GlassGroup spacing={8} style={styles.votes}>
          {MOODS.map((m) => (
            <GlassPressable
              key={m.mood}
              disabled={busy}
              onPress={() => vote(m.mood)}
              tint={data.mine === m.mood ? colors.primary : undefined}
              radius={18}
              style={{ flex: 1 }}
              contentStyle={styles.voteBtn}
            >
              <Text style={{ fontSize: 26 }}>{m.emoji}</Text>
              <Text style={[font.sub, { fontSize: 11 }]}>{m.label}</Text>
            </GlassPressable>
          ))}
        </GlassGroup>
      )}
    </Glass>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' },
  votes: { flexDirection: 'row', gap: 8 },
  voteBtn: { alignItems: 'center', paddingVertical: 10, gap: 2 },
});
