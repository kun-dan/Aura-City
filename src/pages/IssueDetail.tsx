import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronUp, ShieldCheck, X } from 'lucide-react';
import { api } from '../lib/api';
import { useLive, useLookups } from '../state/useLive';
import { useMe } from '../state/AuthContext';
import { StatusBadge, Stars } from '../components/StatusBadge';
import { IssueMap } from '../components/IssueMap';
import { PhotoPicker } from './parts';
import { AUDIT_MIN_CONFIDENCE, AUDIT_MIN_RATING, inr, timeAgo } from '../lib/rules';
import type { Audit, Issue } from '../lib/types';

export function IssueDetail() {
  const { id = '' } = useParams();
  const me = useMe();
  const lookups = useLookups();
  const { data, reload } = useLive(async () => {
    const [issues, upvoted, audits, ledger] = await Promise.all([
      api.listIssues(),
      api.myUpvotes(),
      api.listAudits(id).catch(() => [] as Audit[]),
      api.listLedger(),
    ]);
    return {
      issue: issues.find((i) => i.id === id),
      upvoted: upvoted.has(id),
      audits,
      payments: ledger.filter((l) => l.issue_id === id),
    };
  }, [id]);

  if (!data) return <div className="glass pad">Loading…</div>;
  const { issue, upvoted, audits, payments } = data;
  if (!issue) return <div className="glass pad">Issue not found. <Link to="/">Back</Link></div>;

  const dept = lookups?.dept(issue.department_id);
  const reporter = lookups?.person(issue.reporter_id);
  const worker = lookups?.person(issue.assigned_to);

  return (
    <div className="detail">
      <Link to="/" className="back"><ArrowLeft size={16} /> Back</Link>
      <div className="detail-grid">
        <section className="glass pad stack">
          <div className="row between wrap">
            <h2 style={{ margin: 0 }}>{issue.category ?? 'Classifying…'}</h2>
            <StatusBadge status={issue.status} />
          </div>
          {issue.summary && <p>{issue.summary}</p>}
          {issue.description && <p className="muted small">Citizen note: “{issue.description}”</p>}

          <div className="photos">
            <figure><img src={issue.before_photo_url} alt="Before" /><figcaption>Before</figcaption></figure>
            <figure>
              {issue.after_photo_url ? <img src={issue.after_photo_url} alt="After" /> : <div className="photo-empty">Waiting for repair</div>}
              <figcaption>After</figcaption>
            </figure>
          </div>

          <div className="kv">
            <span>Department</span><b style={{ color: dept?.color }}>{dept?.name ?? '—'}</b>
            <span>Severity</span><b>{issue.severity ? `${issue.severity}/5` : '—'}</b>
            <span>AI confidence</span><b>{issue.ai_confidence != null ? `${Math.round(issue.ai_confidence * 100)}%` : '—'}</b>
            <span>Repair budget</span><b>{inr(issue.bounty)}</b>
            <span>Reported by</span><b>{reporter?.full_name ?? '—'} · {timeAgo(issue.created_at)}</b>
            <span>Resolver</span><b>{worker?.full_name ?? 'Unassigned'}</b>
            <span>Location</span><b>{issue.address ?? `${issue.lat.toFixed(4)}, ${issue.lng.toFixed(4)}`}</b>
          </div>

          {me.role === 'citizen' && <UpvoteButton issue={issue} upvoted={upvoted} onDone={reload} />}
          {me.role === 'resolver' && issue.assigned_to === me.id && <ResolvePanel issue={issue} onDone={reload} />}
          {me.role === 'admin' && <AdminPanel issue={issue} audits={audits} onDone={reload} />}
        </section>

        <section className="stack">
          <div className="glass mini-map"><IssueMap issues={[issue]} height="220px" focus={[issue.lat, issue.lng]} /></div>
          <Timeline issue={issue} />
          {audits.length > 0 && (
            <div className="glass pad stack">
              <h3><ShieldCheck size={18} /> Proof of Resolution</h3>
              {audits.map((a) => <AuditCard key={a.id} audit={a} />)}
            </div>
          )}
          {payments.length > 0 && (
            <div className="glass pad stack">
              <h3>Payments</h3>
              {payments.map((p) => (
                <div key={p.id} className="row between small">
                  <span>{p.kind === 'payout' ? `Paid to ${lookups?.person(p.profile_id)?.full_name ?? 'resolver'}` : 'Platform fee'}</span>
                  <b>{inr(p.amount)}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function UpvoteButton({ issue, upvoted, onDone }: { issue: Issue; upvoted: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const closed = issue.status === 'verified' || issue.status === 'invalid';
  return (
    <button
      className={`btn ${upvoted ? 'primary' : 'ghost'}`}
      disabled={busy || closed}
      onClick={async () => { setBusy(true); try { await api.toggleUpvote(issue.id, !upvoted); onDone(); } finally { setBusy(false); } }}
    >
      <ChevronUp size={16} /> {upvoted ? 'Upvoted' : 'I face this too'} · {issue.upvotes}
    </button>
  );
}

function ResolvePanel({ issue, onDone }: { issue: Issue; onDone: () => void }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Audit | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (result)
    return (
      <div className="glass-inner stack">
        <h3>Audit result</h3>
        <AuditCard audit={result} />
        {result.decision === 'approved' && <div className="success-burst">{inr(issue.bounty)} sent to your wallet</div>}
        {result.decision === 'rejected' && <p className="small">The job is back in your queue. Fix it and upload a clearer photo from the same spot.</p>}
        {result.decision === 'needs_review' && <p className="small">An admin will review this audit.</p>}
      </div>
    );
  if (issue.status !== 'assigned')
    return <p className="small muted">{issue.status === 'verified' ? 'This job is complete and paid.' : 'Your fix has been submitted.'}</p>;

  return (
    <div className="glass-inner stack">
      <h3>Submit your fix</h3>
      <p className="small muted">Take the after photo from the same spot and angle as the before photo. The AI checks that it is the same place and the problem is gone.</p>
      <PhotoPicker file={photo} onFile={setPhoto} label="Upload after photo" />
      {error && <div className="error">{error}</div>}
      <button
        className="btn primary"
        disabled={!photo || busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try { setResult(await api.submitResolution(issue.id, photo!)); onDone(); }
          catch (e) { setError(e instanceof Error ? e.message : String(e)); }
          finally { setBusy(false); }
        }}
      >
        {busy ? 'AI auditor comparing photos…' : 'Submit for AI audit'}
      </button>
    </div>
  );
}

function AdminPanel({ issue, audits, onDone }: { issue: Issue; audits: Audit[]; onDone: () => void }) {
  const lookups = useLookups();
  const [resolver, setResolver] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pending = audits.find((a) => a.decision === 'needs_review' && !a.reviewed_at);
  const resolvers = (lookups?.profiles ?? []).filter((p) => p.role === 'resolver');
  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try { await fn(); onDone(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="glass-inner stack">
      <h3>Admin actions</h3>
      {(issue.status === 'open' || issue.status === 'assigned') && (
        <div className="row gap wrap">
          <select value={resolver} onChange={(e) => setResolver(e.target.value)}>
            <option value="">Reassign to…</option>
            {resolvers.map((r) => (
              <option key={r.id} value={r.id}>{r.full_name} · {lookups?.dept(r.department_id)?.name}</option>
            ))}
          </select>
          <button className="btn ghost" disabled={!resolver} onClick={() => run(() => api.assignIssue(issue.id, resolver))}>Assign</button>
        </div>
      )}
      {pending && (
        <>
          <p className="small">The AI auditor was not confident enough. Compare the photos and decide.</p>
          <input placeholder="Review note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="row gap">
            <button className="btn primary" onClick={() => run(() => api.reviewAudit(pending.id, true, note))}><Check size={16} /> Approve &amp; pay {inr(issue.bounty)}</button>
            <button className="btn danger" onClick={() => run(() => api.reviewAudit(pending.id, false, note))}><X size={16} /> Reject</button>
          </div>
        </>
      )}
      {!pending && !['open', 'assigned'].includes(issue.status) && <p className="small muted">No action needed.</p>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

const DECISION_LABEL: Record<Audit['decision'], string> = {
  approved: 'Approved by AI · paid',
  rejected: 'Rejected by AI',
  needs_review: 'Sent to admin review',
  admin_approved: 'Approved by admin · paid',
  admin_rejected: 'Rejected by admin',
};

export function AuditCard({ audit }: { audit: Audit }) {
  const good = audit.decision === 'approved' || audit.decision === 'admin_approved';
  const bad = audit.decision === 'rejected' || audit.decision === 'admin_rejected';
  return (
    <div className={`audit ${good ? 'good' : bad ? 'bad' : 'warn'}`}>
      <div className="row between wrap">
        <b>{DECISION_LABEL[audit.decision]}</b>
        <Stars value={audit.rating} />
      </div>
      <p className="small">{audit.reasoning}</p>
      <div className="muted small">
        Confidence {Math.round(audit.confidence * 100)}% (needs {AUDIT_MIN_CONFIDENCE * 100}%) · rating needs ≥ {AUDIT_MIN_RATING} · {audit.model} · {timeAgo(audit.created_at)}
      </div>
      {audit.review_note && <div className="small">Admin note: {audit.review_note}</div>}
    </div>
  );
}

function Timeline({ issue }: { issue: Issue }) {
  const steps = [
    { label: 'Reported', at: issue.created_at, done: true },
    { label: 'Classified by AI', at: issue.category ? issue.created_at : null, done: !!issue.category },
    { label: 'Assigned to resolver', at: issue.assigned_at, done: !!issue.assigned_to },
    { label: 'Fix submitted', at: issue.resolved_at, done: !!issue.resolved_at || issue.status === 'verified' },
    { label: 'Verified & paid', at: issue.verified_at, done: issue.status === 'verified' },
  ];
  return (
    <div className="glass pad">
      <h3>Progress</h3>
      <ol className="timeline">
        {steps.map((s) => (
          <li key={s.label} className={s.done ? 'done' : ''}>
            <span>{s.label}</span>
            {s.done && s.at && <small className="muted">{timeAgo(s.at)}</small>}
          </li>
        ))}
      </ol>
    </div>
  );
}
