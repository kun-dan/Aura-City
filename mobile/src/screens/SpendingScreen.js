import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { inr, shortDate } from '../lib/rules';
import { useLive, useLookups } from '../state/auth';
import { Glass, GlassPressable } from '../components/Glass';
import { Screen, Stat } from '../components/ui';
import { colors, font } from '../theme';

const KIND = { budget_topup: ['Budget added', '#34d399'], payout: ['Repair payout', '#f87171'], platform_fee: ['Platform fee', '#c4b5fd'] };

export function LedgerList({ entries }) {
  const lookups = useLookups();
  return (
    <Glass>
      {entries.map((e, i) => {
        const [label, color] = KIND[e.kind];
        const who = lookups?.person(e.profile_id)?.full_name ?? (e.kind === 'platform_fee' ? 'Auracity' : '—');
        const body = (
          <View style={[styles.row, i === entries.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[font.body, { fontWeight: '700' }]}>{label}</Text>
              <Text style={font.sub}>#{e.id} · {who} · {shortDate(e.created_at)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[font.headline, font.number, { color }]}>{e.kind === 'budget_topup' ? '+' : '−'}{inr(e.amount)}</Text>
              <Text style={[font.sub, font.number]}>{inr(e.treasury_balance_after)}</Text>
            </View>
          </View>
        );
        return e.issue_id ? (
          <GlassPressable key={e.id} haptic={false} radius={0} clear onPress={() => router.push(`/issue/${e.issue_id}`)} contentStyle={{ borderWidth: 0 }}>{body}</GlassPressable>
        ) : (
          <View key={e.id}>{body}</View>
        );
      })}
    </Glass>
  );
}

export default function SpendingScreen() {
  const { data } = useLive(async () => ({ treasury: await api.getTreasury(), ledger: await api.listLedger() }));
  if (!data) return <Screen title="Spending" />;
  const paid = data.ledger.filter((l) => l.kind === 'payout');
  const total = paid.reduce((a, b) => a + b.amount, 0);
  return (
    <Screen title="Spending" subtitle="Where the money goes">
      <View style={styles.stats}>
        <Stat label="Treasury" value={inr(data.treasury.balance)} accent="#38e1ff" />
        <Stat label="Paid for repairs" value={inr(total)} sub={`${paid.length} verified payouts`} accent="#22c55e" />
      </View>
      <Text style={font.sub}>Money moves from the city treasury to a worker's wallet only after the AI verifies the repair. Entries can never be edited or deleted.</Text>
      <LedgerList entries={data.ledger} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
});
