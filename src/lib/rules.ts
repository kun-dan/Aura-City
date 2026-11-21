import type { IssueStatus, Mood } from './types';

export const POINTS_VALID_REPORT = 10;
export const POINTS_ISSUE_FIXED = 5;
export const AUDIT_MIN_RATING = 3;
export const AUDIT_MIN_CONFIDENCE = 0.7;
export const MOOD_WINDOW_MS = 2 * 60 * 60 * 1000;

export const computeBounty = (base: number, severity: number) =>
  Math.round(base * (0.6 + 0.2 * Math.min(5, Math.max(1, severity))) * 100) / 100;

export const STATUS_META: Record<IssueStatus, { label: string; color: string }> = {
  classifying: { label: 'AI classifying', color: '#94a3b8' },
  invalid: { label: 'Not a civic issue', color: '#64748b' },
  open: { label: 'Open', color: '#ef4444' },
  assigned: { label: 'Assigned', color: '#f43f5e' },
  pending_audit: { label: 'Under AI audit', color: '#f59e0b' },
  needs_review: { label: 'Admin review', color: '#fb923c' },
  verified: { label: 'Fixed & verified', color: '#22c55e' },
};

export const ACTIVE_STATUSES: IssueStatus[] = ['open', 'assigned', 'pending_audit', 'needs_review'];

export const MOODS: { mood: Mood; emoji: string; label: string; color: string }[] = [
  { mood: 'happy', emoji: '😊', label: 'Happy', color: '#22c55e' },
  { mood: 'calm', emoji: '😌', label: 'Calm', color: '#38bdf8' },
  { mood: 'concerned', emoji: '😟', label: 'Concerned', color: '#f59e0b' },
  { mood: 'angry', emoji: '😠', label: 'Angry', color: '#ef4444' },
];

export const inr = (n: number | null | undefined) => {
  if (n == null) return '—';
  const digits = Number.isInteger(n) ? 0 : 2;
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export const timeAgo = (iso: string) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const DEFAULT_CENTER: [number, number] = [25.4358, 81.8463];
