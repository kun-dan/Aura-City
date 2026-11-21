export const POINTS_VALID_REPORT = 10;
export const POINTS_ISSUE_FIXED = 5;
export const AUDIT_MIN_RATING = 3;
export const AUDIT_MIN_CONFIDENCE = 0.7;
export const MOOD_WINDOW_MS = 2 * 60 * 60 * 1000;
export const FEE_RATE = 0.02;

export const computeBounty = (base, severity) =>
  Math.round(base * (0.6 + 0.2 * Math.min(5, Math.max(1, severity))) * 100) / 100;

export const STATUS_META = {
  classifying: { label: 'AI classifying', color: '#94a3b8' },
  invalid: { label: 'Not a civic issue', color: '#64748b' },
  open: { label: 'Open', color: '#ef4444' },
  assigned: { label: 'Assigned', color: '#fb7185' },
  pending_audit: { label: 'Under AI audit', color: '#f59e0b' },
  needs_review: { label: 'Admin review', color: '#fb923c' },
  verified: { label: 'Fixed & verified', color: '#22c55e' },
};

export const ACTIVE_STATUSES = ['open', 'assigned', 'pending_audit', 'needs_review'];

export const MOODS = [
  { mood: 'happy', emoji: '😊', label: 'Happy', color: '#22c55e' },
  { mood: 'calm', emoji: '😌', label: 'Calm', color: '#38bdf8' },
  { mood: 'concerned', emoji: '😟', label: 'Concerned', color: '#f59e0b' },
  { mood: 'angry', emoji: '😠', label: 'Angry', color: '#ef4444' },
];

export const DEPARTMENT_CODES = ['roads', 'water', 'electricity', 'sanitation', 'parks', 'general'];

const groupIndian = (intPart) => {
  const s = String(intPart);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
};

export const inr = (n) => {
  if (n == null || Number.isNaN(n)) return '—';
  const neg = n < 0;
  const abs = Math.abs(n);
  const int = Math.floor(abs);
  const frac = Math.round((abs - int) * 100);
  return `${neg ? '−' : ''}₹${groupIndian(int)}${frac ? '.' + String(frac).padStart(2, '0') : ''}`;
};

export const timeAgo = (iso) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const shortDate = (iso) => {
  const d = new Date(iso);
  const pad = (x) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const priority = (i) => i.upvotes * 2 + (i.severity ?? 0) * 3;

export const DEFAULT_REGION = { latitude: 25.4358, longitude: 81.8463, latitudeDelta: 0.09, longitudeDelta: 0.09 };
