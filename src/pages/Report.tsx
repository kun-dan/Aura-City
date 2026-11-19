import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crosshair, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { DEFAULT_CENTER, inr, POINTS_VALID_REPORT } from '../lib/rules';
import { LocationPicker } from '../components/IssueMap';
import { StatusBadge } from '../components/StatusBadge';
import { PhotoPicker } from './parts';
import { useLookups } from '../state/useLive';
import type { Issue } from '../lib/types';

export function Report() {
  const nav = useNavigate();
  const lookups = useLookups();
  const [photo, setPhoto] = useState<File | null>(null);
  const [pos, setPos] = useState<[number, number]>(DEFAULT_CENTER);
  const [located, setLocated] = useState<'idle' | 'locating' | 'ok' | 'denied'>('idle');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phase, setPhase] = useState<'form' | 'classifying' | 'done'>('form');
  const [result, setResult] = useState<Issue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locate = () => {
    if (!navigator.geolocation) return setLocated('denied');
    setLocated('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos([p.coords.latitude, p.coords.longitude]); setLocated('ok'); },
      () => setLocated('denied'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };
  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo) return setError('Please add a photo of the issue.');
    setError(null);
    setPhase('classifying');
    try {
      const issue = await api.reportIssue({ photo, lat: pos[0], lng: pos[1], description, address: address || undefined });
      setResult(issue);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('form');
    }
  };

  if (phase === 'classifying')
    return (
      <div className="center-card glass">
        <div className="scanner"><Sparkles size={34} /></div>
        <h2>Vision AI is looking at your photo…</h2>
        <p className="muted">Finding the issue type, the right department and a short summary.</p>
      </div>
    );

  if (phase === 'done' && result) {
    const dept = lookups?.dept(result.department_id);
    const worker = lookups?.person(result.assigned_to);
    return (
      <div className="center-card glass">
        {result.status === 'invalid' ? (
          <>
            <h2>This doesn't look like a civic issue</h2>
            <p className="muted">{result.summary}</p>
            <p className="small muted">No points awarded. Try a clearer photo of the problem.</p>
          </>
        ) : (
          <>
            <div className="success-burst">+{POINTS_VALID_REPORT} points</div>
            <h2>{result.category}</h2>
            <StatusBadge status={result.status} />
            <p>{result.summary}</p>
            <div className="kv">
              <span>Department</span><b style={{ color: dept?.color }}>{dept?.name ?? '—'}</b>
              <span>Severity</span><b>{result.severity}/5</b>
              <span>AI confidence</span><b>{Math.round((result.ai_confidence ?? 0) * 100)}%</b>
              <span>Assigned to</span><b>{worker?.full_name ?? 'Waiting for a worker'}</b>
              <span>Repair budget</span><b>{inr(result.bounty)}</b>
            </div>
          </>
        )}
        <div className="row gap">
          <Link className="btn primary" to={`/issue/${result.id}`}>View issue</Link>
          <button className="btn ghost" onClick={() => { setPhoto(null); setDescription(''); setAddress(''); setResult(null); setPhase('form'); }}>Report another</button>
          <button className="btn ghost" onClick={() => nav('/')}>Back to map</button>
        </div>
      </div>
    );
  }

  return (
    <form className="report glass" onSubmit={submit}>
      <h2>Report an issue</h2>
      <div className="report-grid">
        <div className="stack">
          <PhotoPicker file={photo} onFile={setPhoto} label="Take or upload a photo" />
          <textarea placeholder="What's wrong? (optional, helps the AI) e.g. deep pothole near the bus stop" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
          <input placeholder="Landmark / address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={120} />
        </div>
        <div className="stack">
          <div className="row between">
            <span className="small muted">
              {located === 'locating' ? 'Finding your location…' : located === 'ok' ? 'Using your location. Drag the pin to adjust.' : 'Tap the map or drag the pin to the exact spot.'}
            </span>
            <button type="button" className="btn ghost small" onClick={locate}><Crosshair size={14} /> Locate me</button>
          </div>
          <div className="picker-wrap"><LocationPicker value={pos} onChange={setPos} /></div>
          <span className="small muted">{pos[0].toFixed(5)}, {pos[1].toFixed(5)}</span>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn primary big" disabled={!photo}>Submit report</button>
    </form>
  );
}
