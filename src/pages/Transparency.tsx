import { api } from '../lib/api';
import { useLive, useLookups } from '../state/useLive';
import { inr } from '../lib/rules';
import { Stat } from './parts';
import { Link } from 'react-router-dom';
import type { LedgerEntry } from '../lib/types';

const KIND_LABEL: Record<LedgerEntry['kind'], string> = {
  budget_topup: 'Budget added',
  payout: 'Repair payout',
  platform_fee: 'Platform fee',
};

export function LedgerTable({ entries, limit }: { entries: LedgerEntry[]; limit?: number }) {
  const lookups = useLookups();
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>When</th><th>Type</th><th>To / By</th><th>Issue</th><th className="num">Amount</th><th className="num">Treasury after</th></tr>
        </thead>
        <tbody>
          {entries.slice(0, limit).map((e) => (
            <tr key={e.id}>
              <td className="muted">{e.id}</td>
              <td>{new Date(e.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td><span className={`kind ${e.kind}`}>{KIND_LABEL[e.kind]}</span></td>
              <td>{lookups?.person(e.profile_id)?.full_name ?? (e.kind === 'platform_fee' ? 'Auracity' : '—')}</td>
              <td>{e.issue_id ? <Link to={`/issue/${e.issue_id}`}>view</Link> : '—'}</td>
              <td className={`num ${e.kind === 'budget_topup' ? 'pos' : 'neg'}`}>{e.kind === 'budget_topup' ? '+' : '−'}{inr(e.amount)}</td>
              <td className="num">{inr(e.treasury_balance_after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Transparency() {
  const { data } = useLive(async () => ({ treasury: await api.getTreasury(), ledger: await api.listLedger() }));
  if (!data) return <div className="glass pad">Loading…</div>;
  const paid = data.ledger.filter((l) => l.kind === 'payout');
  const total = paid.reduce((a, b) => a + b.amount, 0);
  return (
    <div className="stack">
      <div className="glass pad">
        <h2>Where the money goes</h2>
        <p className="muted small">Every rupee moves from the city treasury to a worker's wallet only after the AI verifies the repair. This ledger is append-only: entries cannot be edited or deleted.</p>
      </div>
      <div className="stats">
        <Stat label="Treasury balance" value={inr(data.treasury.balance)} accent="#22d3ee" />
        <Stat label="Paid for verified repairs" value={inr(total)} sub={`${paid.length} payouts`} accent="#22c55e" />
        <Stat label="Average payout" value={inr(paid.length ? Math.round(total / paid.length) : 0)} accent="#a78bfa" />
      </div>
      <div className="glass pad"><LedgerTable entries={data.ledger} /></div>
    </div>
  );
}
