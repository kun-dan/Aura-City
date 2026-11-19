import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { api } from '../lib/api';
import { useLive, useLookups } from '../state/useLive';
import { useMe } from '../state/AuthContext';
import { ACTIVE_STATUSES, STATUS_META, inr, timeAgo } from '../lib/rules';
import { StatusBadge, Stars } from '../components/StatusBadge';
import { MoodWidget } from '../components/MoodWidget';
import { Stat } from './parts';
import { AuditCard } from './IssueDetail';
import { LedgerTable } from './Transparency';
import type { Audit, Issue, IssueStatus, LedgerEntry, ResolverStat, Role, Treasury } from '../lib/types';

type Tab = 'overview' | 'issues' | 'audits' | 'contractors' | 'users';
const priority = (i: Issue) => i.upvotes * 2 + (i.severity ?? 0) * 3;

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const { data, reload } = useLive(async () => {
    const [issues, audits, treasury, ledger, resolvers] = await Promise.all([
      api.listIssues(), api.listAudits(), api.getTreasury(), api.listLedger(), api.resolverStats(),
    ]);
    return { issues, audits, treasury, ledger, resolvers };
  });
  const lookups = useLookups();
  if (!data) return <div className="glass pad">Loading…</div>;

  const pending = data.audits.filter((a) => a.decision === 'needs_review' && !a.reviewed_at);
  return (
    <div className="stack">
      <div className="tabs big glass">
        {(['overview', 'issues', 'audits', 'contractors', 'users'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}{t === 'audits' && pending.length > 0 && <span className="count">{pending.length}</span>}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview data={data} pendingCount={pending.length} lookups={lookups} onChange={reload} />}
      {tab === 'issues' && <IssuesTab issues={data.issues} lookups={lookups} />}
      {tab === 'audits' && <AuditsTab data={data} lookups={lookups} onChange={reload} />}
      {tab === 'contractors' && <ContractorsTab resolvers={data.resolvers} lookups={lookups} />}
      {tab === 'users' && <UsersTab lookups={lookups} />}
    </div>
  );
}

interface Data {
  issues: Issue[];
  audits: Audit[];
  treasury: Treasury;
  ledger: LedgerEntry[];
  resolvers: ResolverStat[];
}
type Lookups = ReturnType<typeof useLookups>;

function Overview({ data, pendingCount, lookups, onChange }: { data: Data; pendingCount: number; lookups: Lookups; onChange: () => void }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const active = data.issues.filter((i) => ACTIVE_STATUSES.includes(i.status));
  const verified = data.issues.filter((i) => i.status === 'verified');
  const paid = data.ledger.filter((l) => l.kind === 'payout').reduce((a, b) => a + b.amount, 0);
  const committed = active.reduce((a, b) => a + (b.bounty ?? 0), 0);
  const hours = verified.filter((i) => i.verified_at).map((i) => (new Date(i.verified_at!).getTime() - new Date(i.created_at).getTime()) / 3600_000);
  const avgHours = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null;
  const top = [...active].sort((a, b) => priority(b) - priority(a)).slice(0, 6);

  const byDept = (lookups?.departments ?? []).map((d) => ({
    d,
    active: active.filter((i) => i.department_id === d.id).length,
    fixed: verified.filter((i) => i.department_id === d.id).length,
  }));
  const maxDept = Math.max(1, ...byDept.map((x) => x.active + x.fixed));

  return (
    <>
      <div className="stats">
        <Stat label="Treasury" value={inr(data.treasury.balance)} sub={`${inr(committed)} committed to open jobs`} accent="#22d3ee" />
        <Stat label="Pending audits" value={pendingCount} sub="need an admin decision" accent="#fb923c" />
        <Stat label="Active issues" value={active.length} sub={`${data.issues.filter((i) => i.status === 'open').length} unassigned`} accent="#f43f5e" />
        <Stat label="Verified repairs" value={verified.length} sub={avgHours ? `avg ${avgHours.toFixed(1)} h to fix` : undefined} accent="#22c55e" />
        <Stat label="Total paid out" value={inr(paid)} sub={`fee rate ${(data.treasury.fee_rate * 100).toFixed(1)}%`} accent="#a78bfa" />
      </div>
      <div className="grid-2">
        <div className="glass pad stack">
          <h3>Top priority (upvotes + severity)</h3>
          {top.length === 0 && <p className="muted small">No active issues.</p>}
          {top.map((i) => (
            <Link key={i.id} to={`/issue/${i.id}`} className="prio-row">
              <img src={i.before_photo_url} alt="" />
              <div className="grow">
                <b>{i.category}</b>
                <div className="muted small">{lookups?.dept(i.department_id)?.name} · {i.address ?? ''}</div>
              </div>
              <div className="row-right">
                <StatusBadge status={i.status} />
                <span className="small">▲{i.upvotes} · sev {i.severity}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="stack">
          <div className="glass pad stack">
            <h3>By department</h3>
            {byDept.map(({ d, active: a, fixed: f }) => (
              <div key={d.id} className="dept-bar">
                <span className="small">{d.name}</span>
                <div className="bar">
                  <span style={{ width: `${(a / maxDept) * 100}%`, background: '#f43f5e' }} title={`${a} active`} />
                  <span style={{ width: `${(f / maxDept) * 100}%`, background: '#22c55e' }} title={`${f} fixed`} />
                </div>
                <span className="small muted">{a}/{f}</span>
              </div>
            ))}
            <div className="muted small">red = active, green = fixed</div>
          </div>
          <MoodWidget canVote={false} />
          <form
            className="glass pad stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try { await api.topUpBudget(Number(amount)); setAmount(''); onChange(); }
              catch (err) { setError(err instanceof Error ? err.message : String(err)); }
            }}
          >
            <h3>Add repair budget</h3>
            <div className="row gap">
              <input type="number" min={1} step={1} placeholder="Amount in ₹" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              <button className="btn primary">Add</button>
            </div>
            {error && <div className="error">{error}</div>}
          </form>
        </div>
      </div>
      <div className="glass pad stack">
        <h3>Recent ledger</h3>
        <LedgerTable entries={data.ledger} limit={8} />
      </div>
    </>
  );
}

function IssuesTab({ issues, lookups }: { issues: Issue[]; lookups: Lookups }) {
  const [status, setStatus] = useState<IssueStatus | ''>('');
  const [dept, setDept] = useState('');
  const rows = useMemo(
    () => issues.filter((i) => (!status || i.status === status) && (!dept || i.department_id === dept)).sort((a, b) => priority(b) - priority(a)),
    [issues, status, dept],
  );
  return (
    <div className="glass pad stack">
      <div className="row gap wrap">
        <select value={status} onChange={(e) => setStatus(e.target.value as IssueStatus | '')}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>
          {lookups?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="muted small">{rows.length} issues · sorted by priority</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Issue</th><th>Department</th><th>Status</th><th>Resolver</th><th className="num">▲</th><th className="num">Sev</th><th className="num">Budget</th><th>Age</th></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td><Link to={`/issue/${i.id}`}>{i.category ?? 'Classifying…'}</Link><div className="muted small ellipsis" style={{ maxWidth: 260 }}>{i.address ?? i.summary}</div></td>
                <td>{lookups?.dept(i.department_id)?.name ?? '—'}</td>
                <td><StatusBadge status={i.status} /></td>
                <td>{lookups?.person(i.assigned_to)?.full_name ?? '—'}</td>
                <td className="num">{i.upvotes}</td>
                <td className="num">{i.severity ?? '—'}</td>
                <td className="num">{inr(i.bounty)}</td>
                <td className="muted">{timeAgo(i.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditsTab({ data, lookups, onChange }: { data: Data; lookups: Lookups; onChange: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const pending = data.audits.filter((a) => a.decision === 'needs_review' && !a.reviewed_at);
  const history = data.audits.filter((a) => !pending.includes(a));
  const issue = (id: string) => data.issues.find((i) => i.id === id);
  const decide = async (id: string, approve: boolean) => {
    setError(null);
    try { await api.reviewAudit(id, approve); onChange(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div className="stack">
      <div className="glass pad stack">
        <h3>Needs your decision ({pending.length})</h3>
        {error && <div className="error">{error}</div>}
        {pending.length === 0 && <p className="muted small">All clear. The AI auditor handled everything.</p>}
        {pending.map((a) => {
          const i = issue(a.issue_id);
          return (
            <div key={a.id} className="review-card">
              <div className="photos">
                <figure><img src={i?.before_photo_url} alt="Before" /><figcaption>Before</figcaption></figure>
                <figure><img src={i?.after_photo_url ?? ''} alt="After" /><figcaption>After</figcaption></figure>
              </div>
              <div className="stack">
                <Link to={`/issue/${a.issue_id}`}><b>{i?.category}</b></Link>
                <span className="small muted">{lookups?.person(a.resolver_id)?.full_name} · {inr(i?.bounty)}</span>
                <AuditCard audit={a} />
                <div className="row gap">
                  <button className="btn primary" onClick={() => decide(a.id, true)}><Check size={16} /> Approve &amp; pay</button>
                  <button className="btn danger" onClick={() => decide(a.id, false)}><X size={16} /> Reject</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="glass pad stack">
        <h3>Audit history</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Issue</th><th>Resolver</th><th>Rating</th><th className="num">Conf.</th><th>Decision</th></tr></thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{timeAgo(a.created_at)}</td>
                  <td><Link to={`/issue/${a.issue_id}`}>{issue(a.issue_id)?.category ?? 'issue'}</Link></td>
                  <td>{lookups?.person(a.resolver_id)?.full_name}</td>
                  <td><Stars value={a.rating} /></td>
                  <td className="num">{Math.round(a.confidence * 100)}%</td>
                  <td><span className={`kind ${a.decision.includes('approved') ? 'budget_topup' : 'payout'}`}>{a.decision.replace('_', ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ContractorsTab({ resolvers, lookups }: { resolvers: Data['resolvers']; lookups: Lookups }) {
  return (
    <div className="glass pad stack">
      <h3>Resolvers &amp; contractors</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Department</th><th className="num">Active</th><th className="num">Completed</th><th>Avg AI rating</th><th className="num">Earned</th></tr></thead>
          <tbody>
            {[...resolvers].sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0)).map((r) => (
              <tr key={r.id}>
                <td>{r.full_name}</td>
                <td>{lookups?.dept(r.department_id)?.name ?? '—'}</td>
                <td className="num">{r.active_jobs}</td>
                <td className="num">{r.completed_jobs}</td>
                <td>{r.avg_rating != null ? <><Stars value={Math.round(r.avg_rating)} /> <span className="small muted">{r.avg_rating.toFixed(1)}</span></> : <span className="muted">—</span>}</td>
                <td className="num">{inr(r.wallet_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTab({ lookups }: { lookups: Lookups }) {
  const me = useMe();
  const [error, setError] = useState<string | null>(null);
  const change = async (id: string, role: Role, deptCode?: string) => {
    setError(null);
    try { await api.setUserRole(id, role, deptCode); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div className="glass pad stack">
      <h3>People &amp; roles</h3>
      <p className="muted small">Sign-ups are citizens. Promote verified department workers to resolvers here.</p>
      {error && <div className="error">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Department</th><th className="num">Points</th></tr></thead>
          <tbody>
            {lookups?.profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.full_name}</td>
                <td>
                  <select value={p.role} disabled={p.id === me.id} onChange={(e) => change(p.id, e.target.value as Role, e.target.value === 'resolver' ? 'general' : undefined)}>
                    <option value="citizen">citizen</option>
                    <option value="resolver">resolver</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>
                  {p.role === 'resolver' ? (
                    <select value={lookups.dept(p.department_id)?.code ?? ''} onChange={(e) => change(p.id, 'resolver', e.target.value)}>
                      {lookups.departments.map((d) => <option key={d.id} value={d.code}>{d.name}</option>)}
                    </select>
                  ) : '—'}
                </td>
                <td className="num">{p.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
