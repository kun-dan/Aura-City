import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { inr } from '../lib/rules';
import { photoSource } from '../lib/photos';
import { useLive, useLookups } from '../state/auth';
import { Glass } from '../components/Glass';
import { Button, Card, Empty, ErrorText, Screen, SectionTitle } from '../components/ui';
import { AuditCard } from './IssueScreen';
import { font } from '../theme';

export default function AuditsScreen() {
  const lookups = useLookups();
  const { data, reload } = useLive(async () => ({ audits: await api.listAudits(), issues: await api.listIssues() }));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  if (!data) return <Screen title="Audits" />;
  const pending = data.audits.filter((a) => a.decision === 'needs_review' && !a.reviewed_at);
  const history = data.audits.filter((a) => !pending.includes(a));
  const issue = (id) => data.issues.find((i) => i.id === id);
  const decide = async (id, approve) => {
    setBusy(id);
    setError(null);
    try {
      await api.reviewAudit(id, approve);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="Audits" subtitle="Proof of Resolution">
      <ErrorText text={error} />
      <SectionTitle>Needs your decision ({pending.length})</SectionTitle>
      {pending.length === 0 && <Empty text="All clear. The AI auditor handled everything." />}
      {pending.map((a) => {
        const i = issue(a.issue_id);
        return (
          <Card key={a.id}>
            <Text style={font.headline} onPress={() => router.push(`/issue/${a.issue_id}`)}>{i?.category} · {inr(i?.bounty)}</Text>
            <Text style={font.sub}>{lookups?.person(a.resolver_id)?.full_name} · {i?.address}</Text>
            <View style={styles.photos}>
              {[['Before', i?.before_photo_url], ['After', i?.after_photo_url]].map(([label, src]) => (
                <Glass key={label} radius={14} style={styles.photo}>
                  <Image source={photoSource(src)} style={StyleSheet.absoluteFill} />
                  <Text style={styles.label}>{label}</Text>
                </Glass>
              ))}
            </View>
            <AuditCard audit={a} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Approve & pay" icon="checkmark" variant="good" style={{ flex: 1 }} loading={busy === a.id} onPress={() => decide(a.id, true)} />
              <Button title="Reject" icon="close" variant="danger" style={{ flex: 1 }} disabled={busy === a.id} onPress={() => decide(a.id, false)} />
            </View>
          </Card>
        );
      })}
      <SectionTitle>History</SectionTitle>
      {history.map((a) => (
        <View key={a.id} style={{ gap: 4 }}>
          <Text style={[font.sub, { marginLeft: 4 }]} onPress={() => router.push(`/issue/${a.issue_id}`)}>
            {issue(a.issue_id)?.category ?? 'Issue'} · {lookups?.person(a.resolver_id)?.full_name}
          </Text>
          <AuditCard audit={a} />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photos: { flexDirection: 'row', gap: 10 },
  photo: { flex: 1, aspectRatio: 4 / 3 },
  label: { position: 'absolute', top: 6, left: 8, color: '#fff', fontWeight: '800', fontSize: 11, textShadowColor: '#000', textShadowRadius: 4 },
});
