import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { AUDIT_MIN_CONFIDENCE, AUDIT_MIN_RATING, inr, timeAgo } from '../lib/rules';
import { photoSource } from '../lib/photos';
import { useLive, useLookups, useMe } from '../state/auth';
import { LeafletMap } from '../components/LeafletMap';
import { PhotoField } from '../components/PhotoField';
import { Glass, GlassPressable } from '../components/Glass';
import { Backdrop, Badge, Button, Card, ErrorText, IconButton, Stars } from '../components/ui';
import { KV } from './ReportScreen';
import { colors, font } from '../theme';

const DECISION = {
  approved: ['Approved by AI · paid', 'good'],
  rejected: ['Rejected by AI', 'bad'],
  needs_review: ['Sent to admin review', 'warn'],
  admin_approved: ['Approved by admin · paid', 'good'],
  admin_rejected: ['Rejected by admin', 'bad'],
};
const TONE = { good: '#10b981', bad: '#ef4444', warn: '#f59e0b' };

export function AuditCard({ audit }) {
  const [label, tone] = DECISION[audit.decision];
  return (
    <Glass tint={TONE[tone]} radius={18} style={{ padding: 14, gap: 6 }}>
      <View style={styles.between}>
        <Text style={font.headline}>{label}</Text>
        <Stars value={audit.rating} />
      </View>
      <Text style={font.body}>{audit.reasoning}</Text>
      <Text style={font.sub}>
        Confidence {Math.round(audit.confidence * 100)}% (needs {AUDIT_MIN_CONFIDENCE * 100}%) · rating needs ≥ {AUDIT_MIN_RATING} · {audit.model} · {timeAgo(audit.created_at)}
      </Text>
      {audit.review_note ? <Text style={font.sub}>Admin note: {audit.review_note}</Text> : null}
    </Glass>
  );
}

export default function IssueScreen() {
  const { id } = useLocalSearchParams();
  const me = useMe();
  const insets = useSafeAreaInsets();
  const lookups = useLookups();
  const { data, reload } = useLive(async () => {
    const [issue, upvoted, audits, ledger] = await Promise.all([api.getIssue(id), api.myUpvotes(), api.listAudits(id), api.listLedger()]);
    return { issue, upvoted: upvoted.has(id), audits, payments: ledger.filter((l) => l.issue_id === id) };
  }, [id]);

  const issue = data?.issue;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.between}>
          <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          {issue ? <Badge status={issue.status} /> : null}
        </View>
        {!data ? null : !issue ? (
          <Card><Text style={font.body}>Issue not found.</Text></Card>
        ) : (
          <Detail issue={issue} data={data} me={me} lookups={lookups} reload={reload} />
        )}
      </ScrollView>
    </View>
  );
}

function Detail({ issue, data, me, lookups, reload }) {
  const dept = lookups?.dept(issue.department_id);
  return (
    <>
      <Text style={font.largeTitle}>{issue.category ?? 'Classifying…'}</Text>
      {issue.summary ? <Text style={font.body}>{issue.summary}</Text> : null}
      {issue.description ? <Text style={font.sub}>Citizen note: “{issue.description}”</Text> : null}

      <View style={styles.photos}>
        <Photo label="Before" src={issue.before_photo_url} />
        <Photo label="After" src={issue.after_photo_url} />
      </View>

      <Card>
        <KV k="Department" v={dept?.name} color={dept?.color} />
        <KV k="Severity" v={issue.severity ? `${issue.severity}/5` : '—'} />
        <KV k="AI confidence" v={issue.ai_confidence != null ? `${Math.round(issue.ai_confidence * 100)}%` : '—'} />
        <KV k="Repair budget" v={inr(issue.bounty)} />
        <KV k="Reported by" v={`${lookups?.person(issue.reporter_id)?.full_name ?? '—'} · ${timeAgo(issue.created_at)}`} />
        <KV k="Resolver" v={lookups?.person(issue.assigned_to)?.full_name ?? 'Unassigned'} />
        <KV k="Location" v={issue.address ?? `${issue.lat.toFixed(4)}, ${issue.lng.toFixed(4)}`} />
      </Card>

      {me.role === 'citizen' && <Upvote issue={issue} upvoted={data.upvoted} onDone={reload} />}
      {me.role === 'resolver' && issue.assigned_to === me.id && <Resolve issue={issue} onDone={reload} />}
      {me.role === 'admin' && <AdminActions issue={issue} audits={data.audits} lookups={lookups} onDone={reload} />}

      <Glass style={{ height: 180 }}>
        <LeafletMap issues={[issue]} focus={[issue.lat, issue.lng]} style={{ flex: 1 }} />
      </Glass>

      <Timeline issue={issue} />

      {data.audits.length > 0 && (
        <Card>
          <Text style={font.headline}>Proof of Resolution</Text>
          {data.audits.map((a) => <AuditCard key={a.id} audit={a} />)}
        </Card>
      )}
      {data.payments.length > 0 && (
        <Card>
          <Text style={font.headline}>Payments</Text>
          {data.payments.map((p) => (
            <KV key={p.id} k={p.kind === 'payout' ? `Paid to ${lookups?.person(p.profile_id)?.full_name ?? 'resolver'}` : 'Platform fee'} v={inr(p.amount)} />
          ))}
        </Card>
      )}
    </>
  );
}

function Photo({ label, src }) {
  return (
    <Glass style={{ flex: 1, aspectRatio: 4 / 3 }} radius={18}>
      {src ? <Image source={photoSource(src)} style={styles.fill} resizeMode="cover" /> : <Text style={[font.sub, styles.noPhoto]}>Waiting for repair</Text>}
      <Glass radius={10} style={styles.photoLabel}><Text style={styles.photoLabelText}>{label}</Text></Glass>
    </Glass>
  );
}

function Upvote({ issue, upvoted, onDone }) {
  const [busy, setBusy] = useState(false);
  const closed = issue.status === 'verified' || issue.status === 'invalid';
  return (
    <Button
      title={`${upvoted ? 'Upvoted' : 'I face this too'} · ${issue.upvotes}`}
      icon={upvoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
      variant={upvoted ? 'primary' : 'plain'}
      disabled={busy || closed}
      onPress={async () => {
        setBusy(true);
        try {
          await api.toggleUpvote(issue.id, !upvoted);
          onDone();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

function Resolve({ issue, onDone }) {
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  if (result)
    return (
      <Card>
        <Text style={font.headline}>Audit result</Text>
        <AuditCard audit={result} />
        {result.decision === 'approved' && <Text style={[font.headline, { color: '#86efac' }]}>{inr(issue.bounty)} sent to your wallet</Text>}
        {result.decision === 'rejected' && <Text style={font.sub}>The job is back in your queue. Fix it and upload a clear photo from the same spot.</Text>}
        {result.decision === 'needs_review' && <Text style={font.sub}>An admin will review this audit.</Text>}
      </Card>
    );
  if (issue.status !== 'assigned')
    return <Card><Text style={font.sub}>{issue.status === 'verified' ? 'This job is complete and paid.' : 'Your fix has been submitted.'}</Text></Card>;
  return (
    <Card>
      <Text style={font.headline}>Submit your fix</Text>
      <Text style={font.sub}>Take the after photo from the same spot and angle as the before photo. The AI checks it is the same place and the problem is gone.</Text>
      <PhotoField uri={photo} onChange={setPhoto} label="Upload after photo" />
      <ErrorText text={error} />
      <Button
        title={busy ? 'AI auditor comparing photos…' : 'Submit for AI audit'}
        icon="shield-checkmark"
        loading={busy}
        disabled={!photo}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            setResult(await api.submitResolution(issue.id, photo));
            onDone();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}

function AdminActions({ issue, audits, lookups, onDone }) {
  const [error, setError] = useState(null);
  const pending = audits.find((a) => a.decision === 'needs_review' && !a.reviewed_at);
  const resolvers = (lookups?.profiles ?? []).filter((p) => p.role === 'resolver');
  const run = async (fn) => {
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e.message);
    }
  };
  const canAssign = issue.status === 'open' || issue.status === 'assigned';
  if (!pending && !canAssign) return null;
  return (
    <Card>
      <Text style={font.headline}>Admin actions</Text>
      {pending && (
        <>
          <Text style={font.sub}>The AI auditor was not confident enough. Compare the photos and decide.</Text>
          <View style={styles.rowGap}>
            <Button title="Approve & pay" icon="checkmark" variant="good" style={{ flex: 1 }} onPress={() => run(() => api.reviewAudit(pending.id, true))} />
            <Button title="Reject" icon="close" variant="danger" style={{ flex: 1 }} onPress={() => run(() => api.reviewAudit(pending.id, false))} />
          </View>
        </>
      )}
      {canAssign && (
        <>
          <Text style={font.sub}>Reassign to another resolver:</Text>
          <View style={styles.chips}>
            {resolvers.map((r) => (
              <GlassPressable
                key={r.id}
                radius={14}
                tint={r.id === issue.assigned_to ? colors.primary : undefined}
                onPress={() => run(() => api.assignIssue(issue.id, r.id))}
                contentStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>{r.full_name}</Text>
                <Text style={[font.sub, { fontSize: 11, color: lookups?.dept(r.department_id)?.color }]}>{lookups?.dept(r.department_id)?.name}</Text>
              </GlassPressable>
            ))}
          </View>
        </>
      )}
      <ErrorText text={error} />
    </Card>
  );
}

function Timeline({ issue }) {
  const steps = [
    ['Reported', issue.created_at, true],
    ['Classified by AI', issue.category ? issue.created_at : null, !!issue.category],
    ['Assigned to resolver', issue.assigned_at, !!issue.assigned_to],
    ['Fix submitted', issue.resolved_at, !!issue.resolved_at || issue.status === 'verified'],
    ['Verified & paid', issue.verified_at, issue.status === 'verified'],
  ];
  return (
    <Card>
      <Text style={font.headline}>Progress</Text>
      {steps.map(([label, at, done], i) => (
        <View key={label} style={styles.step}>
          <View style={[styles.stepDot, done && styles.stepDone]} />
          {i < steps.length - 1 && <View style={styles.stepLine} />}
          <Text style={[font.body, { flex: 1, color: done ? colors.text : colors.faint }]}>{label}</Text>
          {done && at ? <Text style={font.sub}>{timeAgo(at)}</Text> : null}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  scroll: { paddingHorizontal: 16, gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  photos: { flexDirection: 'row', gap: 10 },
  noPhoto: { flex: 1, textAlign: 'center', textAlignVertical: 'center', marginTop: 50 },
  photoLabel: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3 },
  photoLabelText: { color: colors.text, fontWeight: '800', fontSize: 11 },
  rowGap: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 30 },
  stepDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.hairline, backgroundColor: colors.bg },
  stepDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  stepLine: { position: 'absolute', left: 6, top: 22, height: 16, width: 2, backgroundColor: colors.hairline },
});
