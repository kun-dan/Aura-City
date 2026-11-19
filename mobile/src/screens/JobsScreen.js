import { StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { inr } from '../lib/rules';
import { useLive, useLookups, useMe } from '../state/auth';
import { Empty, IssueRow, Screen, SectionTitle, Stat } from '../components/ui';
import { font } from '../theme';

export default function JobsScreen() {
  const me = useMe();
  const lookups = useLookups();
  const { data } = useLive(async () => {
    const [issues, audits] = await Promise.all([api.listIssues(), api.listAudits()]);
    return { mine: issues.filter((i) => i.assigned_to === me.id), audits: audits.filter((a) => a.resolver_id === me.id) };
  }, [me.id]);
  const mine = data?.mine ?? [];
  const todo = mine.filter((i) => i.status === 'assigned').sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0) || b.upvotes - a.upvotes);
  const waiting = mine.filter((i) => i.status === 'pending_audit' || i.status === 'needs_review');
  const done = mine.filter((i) => i.status === 'verified');
  const ratings = data?.audits.map((a) => a.rating) ?? [];
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const dept = lookups?.dept(me.department_id);

  const row = (i) => (
    <IssueRow key={i.id} issue={i} dept={lookups?.dept(i.department_id)} right={<><Text style={[font.headline, font.number]}>{inr(i.bounty)}</Text><Text style={font.sub}>sev {i.severity} · ▲{i.upvotes}</Text></>} />
  );
  return (
    <Screen title="My jobs" subtitle={dept?.name ?? 'Resolver'}>
      <View style={styles.stats}>
        <Stat label="Wallet" value={inr(me.wallet_balance)} accent="#22c55e" />
        <Stat label="To do" value={todo.length} accent="#fb7185" />
        <Stat label="Completed" value={done.length} accent="#38e1ff" />
        <Stat label="Avg AI rating" value={avg ? `${avg.toFixed(1)} ★` : '—'} accent="#facc15" />
      </View>
      <Text style={font.sub}>You only see jobs assigned to you. Payment reaches your wallet as soon as the AI approves your fix.</Text>
      <SectionTitle>To do ({todo.length})</SectionTitle>
      {todo.length ? todo.map(row) : <Empty text="No open jobs. Nice work!" />}
      <SectionTitle>Waiting for audit ({waiting.length})</SectionTitle>
      {waiting.length ? waiting.map(row) : <Empty text="Nothing waiting." />}
      <SectionTitle>Completed & paid ({done.length})</SectionTitle>
      {done.length ? done.map(row) : <Empty text="No completed jobs yet." />}
    </Screen>
  );
}

const styles = StyleSheet.create({ stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } });
