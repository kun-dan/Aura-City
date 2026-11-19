import { useState } from 'react';
import { Briefcase, LayoutDashboard, RotateCcw, User } from 'lucide-react';
import { api } from '../lib/api';
import type { Role } from '../lib/types';

const ROLE_META: Record<Role, { icon: React.ReactNode; label: string; blurb: string }> = {
  citizen: { icon: <User size={18} />, label: 'Citizen', blurb: 'Report issues, upvote, vote on City Mood' },
  resolver: { icon: <Briefcase size={18} />, label: 'Resolver', blurb: 'Fix assigned jobs, get paid after AI audit' },
  admin: { icon: <LayoutDashboard size={18} />, label: 'City Admin', blurb: 'Budget, audits and contractors' },
};

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'in') await api.signIn(email, password);
      else await api.signUp(email, password, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const users = api.demo?.users() ?? [];

  return (
    <div className="login">
      <div className="login-hero">
        <img src="/favicon.svg" alt="" className="login-logo" />
        <h1>Auracity</h1>
        <p>Report a civic issue with one photo. AI routes it to the right department, verifies the repair, and releases payment only for real fixes.</p>
        <ol className="steps">
          <li><b>Report</b> Photo + map pin</li>
          <li><b>Classify</b> Vision AI picks the department</li>
          <li><b>Resolve</b> Worker uploads an after photo</li>
          <li><b>Audit &amp; Pay</b> AI verifies, treasury pays</li>
        </ol>
      </div>

      <div className="login-card glass">
        {api.mode === 'demo' ? (
          <>
            <h2>Try the demo</h2>
            <p className="muted small">Data stays in this browser. Open a second tab as another role to watch pins update live.</p>
            {(['citizen', 'resolver', 'admin'] as Role[]).map((role) => (
              <div key={role} className="role-group">
                <div className="role-title">{ROLE_META[role].icon} {ROLE_META[role].label}<span className="muted small"> · {ROLE_META[role].blurb}</span></div>
                <div className="role-users">
                  {users.filter((u) => u.role === role).map((u) => (
                    <button key={u.id} className="user-chip" onClick={() => api.demo!.signInAs(u.id)}>{u.full_name}</button>
                  ))}
                </div>
              </div>
            ))}
            <details className="small">
              <summary>Create a new citizen account</summary>
              <form onSubmit={submit} className="stack" style={{ marginTop: 10 }}>
                <input required placeholder="Your name" value={name} onChange={(e) => { setName(e.target.value); setMode('up'); }} />
                <button className="btn primary" disabled={busy}>Join as citizen</button>
              </form>
            </details>
            <button className="btn ghost small" onClick={() => { if (confirm('Reset all demo data?')) api.demo!.reset(); }}>
              <RotateCcw size={14} /> Reset demo data
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="stack">
            <h2>{mode === 'in' ? 'Sign in' : 'Create your account'}</h2>
            {mode === 'up' && <input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />}
            <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input required type="password" placeholder="Password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
            <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Sign up'}</button>
            <button type="button" className="btn ghost" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
              {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
            </button>
            <p className="muted small">New accounts are citizens. A city admin can make you a resolver.</p>
          </form>
        )}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
