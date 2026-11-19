import { useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { ACTIVE_STATUSES, inr, priority } from '../lib/rules';
import { photoSource } from '../lib/photos';
import { useLive, useLookups } from '../state/auth';
import { MoodWidget } from '../components/MoodWidget';
import { Glass, GlassPressable } from '../components/Glass';
import { Badge, Button, Card, ErrorText, Screen, SectionTitle, Stat, Stars } from '../components/ui';
import { colors, font } from '../theme';

export default function DashboardScreen() {
  const lookups = useLookups();
  const { data } = useLive(async () => {
    const [issues, audits, treasury, ledger, resolvers] = await Promise.all([
      api.listIssues(), api.listAudits(), api.getTreasury(), api.listLedger(), api.resolverStats(),
    ]);
    return { issues, audits, treasury, ledger, resolvers };
  });
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);
  if (!data) return <Screen title="Dashboard" />;

  const active = data.issues.filter((i) => ACTIVE_STATUSES.includes(i.status));
  const verified = data.issues.filter((i) => i.status === 'verified');
  const pending = data.audits.filter((a) => a.decision === 'needs_review' && !a.reviewed_at).length;
  const paid = data.ledger.filter((l) => l.kind === 'payout').reduce((a, b) => a + b.amount, 0);
  const committed = active.reduce((a, b) => a + (b.bounty ?? 0), 0);
  const hours = verified.filter((i) => i.verified_at).map((i) => (new Date(i.verified_at) - new Date(i.created_at)) / 3600_000);
  const avgHours = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null;
  const top = [...active].sort((a, b) => priority(b) - priority(a)).slice(0, 5);
  const byDept = (lookups?.departments ?? []).map((d) => ({
    d,
    a: active.filter((i) => i.department_id === d.id).length,
    f: verified.filter((i) => i.department_id === d.id).length,
  }));
  const maxDept = Math.max(1, ...byDept.map((x) => x.a + x.f));

  const topUp = async () => {
    setError(null);
    try {
      await api.topUpBudget(Number(amount));
      setAmount('');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Screen title="Dashboard" subtitle="Ward 12 · City admin">
      <View style={styles.stats}>
        <Stat label="Treasury" value={inr(data.treasury.balance)} sub={`${inr(committed)} committed`} accent="#38e1ff" />
        <Stat label="Pending audits" value={pending} sub="need your decision" accent="#fb923c" />
        <Stat label="Active issues" value={active.length} sub={`${data.issues.filter((i) => i.status === 'open').length} unassigned`} accent="#fb7185" />
        <Stat label="Verified repairs" value={verified.length} sub={avgHours ? `avg ${avgHours.toFixed(0)} h to fix` : undefined} accent="#22c55e" />
      </View>
      {pending > 0 && <Button title={`Review ${pending} audit${pending > 1 ? 's' : ''}`} icon="shield-checkmark" onPress={() => router.push('/admin/audits')} />}

      <SectionTitle>Top priority</SectionTitle>
      <Text style={font.sub}>Ranked by citizen upvotes and AI severity.</Text>
      {top.map((i) => (
        <GlassPressable key={i.id} onPress={() => router.push(`/issue/${i.id}`)} contentStyle={styles.prio}>
          <Image source={photoSource(i.before_photo_url)} style={styles.thumb} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={font.headline} numberOfLines={1}>{i.category}</Text>
            <Text style={font.sub} numberOfLines={1}>{lookups?.dept(i.department_id)?.name} · {i.address ?? ''}</Text>
            <Badge status={i.status} />
          </View>
          <Text style={[font.sub, { color: colors.text }]}>▲{i.upvotes}{'\n'}sev {i.severity}</Text>
        </GlassPressable>
      ))}

      <SectionTitle>By department</SectionTitle>
      <Card>
        {byDept.map(({ d, a, f }) => (
          <View key={d.id} style={styles.deptRow}>
            <Text style={[font.sub, { width: 110, color: colors.text }]} numberOfLines={1}>{d.name}</Text>
            <View style={styles.bar}>
              <View style={{ width: `${(a / maxDept) * 100}%`, backgroundColor: '#fb7185' }} />
              <View style={{ width: `${(f / maxDept) * 100}%`, backgroundColor: '#22c55e' }} />
            </View>
            <Text style={[font.sub, { width: 34, textAlign: 'right' }]}>{a}/{f}</Text>
          </View>
        ))}
        <Text style={font.sub}>red = active · green = fixed</Text>
      </Card>

      <SectionTitle>Contractors</SectionTitle>
      <Glass>
        {[...data.resolvers].sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0)).map((r, i, arr) => (
          <View key={r.id} style={[styles.contractor, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[font.body, { fontWeight: '700' }]}>{r.full_name}</Text>
              <Text style={[font.sub, { color: lookups?.dept(r.department_id)?.color }]}>{lookups?.dept(r.department_id)?.name}</Text>
              <Text style={font.sub}>{r.active_jobs} active · {r.completed_jobs} done</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {r.avg_rating != null ? <Stars value={Math.round(r.avg_rating)} size={12} /> : <Text style={font.sub}>No audits</Text>}
              <Text style={[font.sub, font.number, { color: colors.text }]}>{inr(r.wallet_balance)}</Text>
            </View>
          </View>
        ))}
      </Glass>

      <MoodWidget canVote={false} />

      <Card>
        <Text style={font.headline}>Add repair budget</Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Glass radius={14} style={{ flex: 1, paddingHorizontal: 14 }}>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Amount in ₹" placeholderTextColor={colors.faint} style={styles.input} />
          </Glass>
          <Button title="Add" icon="add" disabled={!(Number(amount) > 0)} onPress={topUp} />
        </View>
        <Text style={font.sub}>Total paid out so far: {inr(paid)} · platform fee {(data.treasury.fee_rate * 100).toFixed(0)}%</Text>
        <ErrorText text={error} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  prio: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  thumb: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#1e293b' },
  deptRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1, flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' },
  contractor: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  input: { color: colors.text, fontSize: 16, paddingVertical: 12 },
});
