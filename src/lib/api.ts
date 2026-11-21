import type {
  Audit, ChatMessage, Department, Issue, LedgerEntry, Mood, MoodSummary, NewReport, Profile,
  ResolverStat, Role, Treasury,
} from './types';
import { createDemoApi } from './demoApi';
import { createSupabaseApi } from './supabaseApi';

export interface Api {
  mode: 'demo' | 'supabase';

  currentProfile(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, fullName: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthChange(cb: () => void): () => void;

  listDepartments(): Promise<Department[]>;
  listProfiles(): Promise<Profile[]>;
  listIssues(): Promise<Issue[]>;
  myUpvotes(): Promise<Set<string>>;
  listAudits(issueId?: string): Promise<Audit[]>;
  getTreasury(): Promise<Treasury>;
  listLedger(): Promise<LedgerEntry[]>;
  resolverStats(): Promise<ResolverStat[]>;
  cityMood(): Promise<MoodSummary>;
  myMood(): Promise<Mood | null>;

  reportIssue(report: NewReport): Promise<Issue>;
  submitResolution(issueId: string, photo: File): Promise<Audit>;

  toggleUpvote(issueId: string, on: boolean): Promise<void>;
  voteMood(mood: Mood): Promise<void>;
  aurabot(messages: ChatMessage[], role: Role): Promise<string>;

  reviewAudit(auditId: string, approve: boolean, note?: string): Promise<void>;
  assignIssue(issueId: string, resolverId: string): Promise<void>;
  topUpBudget(amount: number, note?: string): Promise<void>;
  setUserRole(userId: string, role: Role, departmentCode?: string): Promise<void>;

  subscribe(cb: () => void): () => void;

  demo?: {
    users(): Profile[];
    signInAs(userId: string): void;
    reset(): void;
  };
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const api: Api = url && key ? createSupabaseApi(url, key) : createDemoApi();
