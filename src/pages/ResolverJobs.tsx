import { api } from '../lib/api';
import { useLive, useLookups } from '../state/useLive';
import { useMe } from '../state/AuthContext';
import { inr } from '../lib/rules';
import { IssueRow, Stat } from './parts';

export function ResolverJobs() {
  const me = useMe();
  const lookups = useLookups();
  const { data } = useLive(async () => {
    const [issues, audits] = await Promise.all([api.listIssues(), api.listAudits()]);
    return { mine: issues.filter((i) => i.assigned_to === me.id), audits: audits.filter((a) => a.resolver_id === me.id) };
  }, [me.id]);
  if (!data) return <div className="glass pad">Loading…</div>;

  const todo = data.mine.filter((i) => i.status === 'assigned').sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0) || b.upvotes - a.upvotes);
  const waiting = data.mine.filter((i) => i.status === 'pending_audit' || i.status === 'needs_review');
  const done = data.mine.filter((i) => i.status === 'verified');
  const avg = data.audits.length ? data.audits.reduce((a, b) => a + b.rating, 0) / data.audits.length : null;
  const dept = lookups?.dept(me.department_id);

  return (
    <div className="stack">
      <div className="glass pad">
        <h2>My jobs</h2>
        <p className="muted small">{dept ? `${dept.name} department.` : ''} You only see jobs assigned to you. Payment reaches your wallet as soon as the AI approves your fix.</p>
      </div>
      <div className="stats">
        <Stat label="Wallet" value={inr(me.wallet_balance)} accent="#22c55e" />
        <Stat label="To do" value={todo.length} accent="#f43f5e" />
        <Stat label="Completed" value={done.length} accent="#22d3ee" />
        <Stat label="Avg AI rating" value={avg ? `${avg.toFixed(1)} ★` : '—'} accent="#eab308" />
      </div>
      <Section title="To do" items={todo} empty="No open jobs. Nice work!" lookups={lookups} />
      <Section title="Waiting for audit" items={waiting} empty="Nothing waiting." lookups={lookups} />
      <Section title="Completed & paid" items={done} empty="No completed jobs yet." lookups={lookups} />
    </div>
  );
}

function Section({ title, items, empty, lookups }: { title: string; items: Parameters<typeof IssueRow>[0]['issue'][]; empty: string; lookups: ReturnType<typeof useLookups> }) {
  return (
    <div className="glass list-card">
      <h3 className="pad-h">{title} <span className="muted">({items.length})</span></h3>
      <div className="issue-list">
        {items.length === 0 && <p className="muted small pad">{empty}</p>}
        {items.map((i) => (
          <IssueRow key={i.id} issue={i} dept={lookups?.dept(i.department_id)} right={<><b>{inr(i.bounty)}</b><span className="muted small">sev {i.severity}/5 · ▲{i.upvotes}</span></>} />
        ))}
      </div>
    </div>
  );
}
