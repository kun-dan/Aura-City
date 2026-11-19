export type Role = 'citizen' | 'resolver' | 'admin';

export type IssueStatus =
  | 'classifying'
  | 'invalid'
  | 'open'
  | 'assigned'
  | 'pending_audit'
  | 'needs_review'
  | 'verified';

export type Mood = 'happy' | 'calm' | 'concerned' | 'angry';
export type LedgerKind = 'budget_topup' | 'payout' | 'platform_fee';
export type AuditDecision = 'approved' | 'rejected' | 'needs_review' | 'admin_approved' | 'admin_rejected';

export interface Department {
  id: string;
  code: string;
  name: string;
  color: string;
  base_bounty: number;
}

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  department_id: string | null;
  points: number;
  wallet_balance: number;
}

export interface Issue {
  id: string;
  created_at: string;
  reporter_id: string;
  lat: number;
  lng: number;
  address: string | null;
  description: string;
  before_photo_url: string;
  after_photo_url: string | null;
  status: IssueStatus;
  category: string | null;
  department_id: string | null;
  summary: string | null;
  severity: number | null;
  ai_confidence: number | null;
  bounty: number | null;
  upvotes: number;
  assigned_to: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  verified_at: string | null;
}

export interface Audit {
  id: string;
  created_at: string;
  issue_id: string;
  resolver_id: string;
  rating: number;
  confidence: number;
  is_legit: boolean;
  reasoning: string;
  model: string;
  decision: AuditDecision;
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
}

export interface LedgerEntry {
  id: number;
  created_at: string;
  kind: LedgerKind;
  amount: number;
  issue_id: string | null;
  audit_id: string | null;
  profile_id: string | null;
  treasury_balance_after: number;
  note: string | null;
}

export interface Treasury {
  balance: number;
  fee_rate: number;
}

export interface ResolverStat {
  id: string;
  full_name: string;
  department_id: string | null;
  wallet_balance: number;
  active_jobs: number;
  completed_jobs: number;
  avg_rating: number | null;
}

export interface MoodSummary {
  counts: Record<Mood, number>;
  total: number;
  majority: Mood | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface NewReport {
  photo: File;
  lat: number;
  lng: number;
  description: string;
  address?: string;
}
