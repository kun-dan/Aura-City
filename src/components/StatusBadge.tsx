import { STATUS_META } from '../lib/rules';
import type { IssueStatus } from '../lib/types';

export function StatusBadge({ status }: { status: IssueStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="badge" style={{ ['--c' as string]: m.color }}>
      <span className="dot" />
      {m.label}
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? 'on' : ''}>★</span>
      ))}
    </span>
  );
}
