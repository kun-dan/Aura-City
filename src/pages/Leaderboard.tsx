import { api } from '../lib/api';
import { useLive } from '../state/useLive';
import { useMe } from '../state/AuthContext';
import { POINTS_ISSUE_FIXED, POINTS_VALID_REPORT } from '../lib/rules';

export function Leaderboard() {
  const me = useMe();
  const { data: profiles = [] } = useLive(() => api.listProfiles());
  const ranked = profiles.filter((p) => p.role === 'citizen').sort((a, b) => b.points - a.points);
  const myRank = ranked.findIndex((p) => p.id === me.id) + 1;

  return (
    <div className="narrow stack">
      <div className="glass pad">
        <h2>Citizen leaderboard</h2>
        <p className="muted small">+{POINTS_VALID_REPORT} for every valid report, +{POINTS_ISSUE_FIXED} more when it gets fixed and verified.</p>
        {myRank > 0 && <div className="pill big">You are #{myRank} with {me.points} points</div>}
      </div>
      <div className="glass">
        {ranked.map((p, i) => (
          <div key={p.id} className={`leader ${p.id === me.id ? 'me' : ''}`}>
            <span className="rank">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
            <span className="grow">{p.full_name}</span>
            <b>{p.points} pts</b>
          </div>
        ))}
      </div>
    </div>
  );
}
