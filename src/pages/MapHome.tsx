import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { api } from '../lib/api';
import { useLive, useLookups } from '../state/useLive';
import { useMe } from '../state/AuthContext';
import { IssueMap, MapLegend } from '../components/IssueMap';
import { MoodWidget } from '../components/MoodWidget';
import { IssueRow } from './parts';
import { ACTIVE_STATUSES } from '../lib/rules';

type Filter = 'all' | 'active' | 'verified' | 'mine';

export function MapHome() {
  const me = useMe();
  const { data: issues = [] } = useLive(() => api.listIssues());
  const lookups = useLookups();
  const [filter, setFilter] = useState<Filter>('active');

  const shown = useMemo(() => {
    if (filter === 'active') return issues.filter((i) => ACTIVE_STATUSES.includes(i.status) || i.status === 'classifying');
    if (filter === 'verified') return issues.filter((i) => i.status === 'verified');
    if (filter === 'mine') return issues.filter((i) => i.reporter_id === me.id);
    return issues;
  }, [issues, filter, me.id]);

  const fixed = issues.filter((i) => i.status === 'verified').length;
  const active = issues.filter((i) => ACTIVE_STATUSES.includes(i.status)).length;

  return (
    <div className="map-page">
      <section className="map-card glass">
        <IssueMap issues={shown} />
        <MapLegend />
        {me.role === 'citizen' && (
          <Link to="/report" className="fab-report"><Camera size={20} /> Report issue</Link>
        )}
      </section>
      <aside className="side">
        <MoodWidget canVote={me.role === 'citizen'} />
        <div className="glass stats-mini">
          <div><b>{active}</b><span>active</span></div>
          <div><b>{fixed}</b><span>fixed</span></div>
          <div><b>{issues.length}</b><span>total</span></div>
        </div>
        <div className="glass list-card">
          <div className="tabs">
            {(['active', 'verified', 'all', ...(me.role === 'citizen' ? ['mine'] : [])] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f === 'verified' ? 'fixed' : f}
              </button>
            ))}
          </div>
          <div className="issue-list">
            {shown.length === 0 && <p className="muted small pad">Nothing here yet.</p>}
            {shown.slice(0, 50).map((i) => (
              <IssueRow key={i.id} issue={i} dept={lookups?.dept(i.department_id)} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
