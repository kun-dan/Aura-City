import { Link } from 'react-router-dom';
import { ChevronUp } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import type { Department, Issue } from '../lib/types';
import { inr, timeAgo } from '../lib/rules';

export function IssueRow({ issue, dept, right }: { issue: Issue; dept?: Department; right?: React.ReactNode }) {
  return (
    <Link to={`/issue/${issue.id}`} className="issue-row">
      <img src={issue.before_photo_url} alt="" />
      <div className="grow">
        <div className="row-title">{issue.category ?? 'Classifying…'}</div>
        <div className="muted small ellipsis">{issue.address || issue.summary || issue.description}</div>
        <div className="row-meta">
          <StatusBadge status={issue.status} />
          {dept && <span className="dept" style={{ ['--c' as string]: dept.color }}>{dept.name}</span>}
        </div>
      </div>
      <div className="row-right">
        {right ?? (
          <>
            <span className="up"><ChevronUp size={14} />{issue.upvotes}</span>
            <span className="muted small">{timeAgo(issue.created_at)}</span>
            {issue.bounty != null && <span className="small">{inr(issue.bounty)}</span>}
          </>
        )}
      </div>
    </Link>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string }) {
  return (
    <div className="glass stat" style={accent ? { ['--accent' as string]: accent } : undefined}>
      <div className="eyebrow">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  );
}

export function PhotoPicker({ file, onFile, label }: { file: File | null; onFile: (f: File | null) => void; label: string }) {
  const preview = file ? URL.createObjectURL(file) : null;
  return (
    <label className={`photo-picker ${preview ? 'has' : ''}`}>
      {preview ? <img src={preview} alt="" onLoad={() => URL.revokeObjectURL(preview)} /> : <span>📷 {label}</span>}
      <input type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}
