// Demo mode: the whole pipeline in the browser. Shared state lives in localStorage so several
// tabs (citizen, resolver, admin) see each other's changes live. The session is per tab.
// AI steps are simple heuristics, clearly labelled, standing in for the Groq edge functions.
import type { Api } from './api';
import type { Audit, ChatMessage, Issue, Mood, MoodSummary, Profile, Role } from './types';
import { buildSeed, DEMO_VERSION, type DemoState } from './demoSeed';
import {
  AUDIT_MIN_CONFIDENCE, AUDIT_MIN_RATING, computeBounty, MOOD_WINDOW_MS, POINTS_ISSUE_FIXED, POINTS_VALID_REPORT,
} from './rules';
import { blobToDataUrl, compareImages, compressImage } from './image';

const STATE_KEY = 'auracity-demo-state';
const SESSION_KEY = 'auracity-demo-session';
const CHANNEL = 'auracity-demo';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const round2 = (n: number) => Math.round(n * 100) / 100;

const KEYWORDS: { re: RegExp; dept: string; category: string; severity: number }[] = [
  { re: /pothole|crater|road|asphalt|speed ?breaker|footpath|divider/i, dept: 'roads', category: 'Pothole / road damage', severity: 3 },
  { re: /leak|pipe|water|drain|sewer|flood|logging/i, dept: 'water', category: 'Water leak / drainage', severity: 3 },
  { re: /light|lamp|wire|electric|pole|transformer|power|spark/i, dept: 'electricity', category: 'Electrical fault', severity: 3 },
  { re: /garbage|trash|waste|dump|litter|smell|bin|dirty/i, dept: 'sanitation', category: 'Garbage dump', severity: 2 },
  { re: /tree|park|branch|garden|bench|grass/i, dept: 'parks', category: 'Park / tree issue', severity: 2 },
];
const DANGER = /danger|accident|spark|live wire|child|injur|urgent|deep|fire|collapse/i;
const NOT_CIVIC = /selfie|meme|test photo|my food|my pet/i;

export function createDemoApi(): Api {
  const listeners = new Set<() => void>();
  const authListeners = new Set<() => void>();
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
  const notify = () => listeners.forEach((l) => l());

  channel?.addEventListener('message', notify);
  window.addEventListener('storage', (e) => {
    if (e.key === STATE_KEY) notify();
  });

  const load = (): DemoState => {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as DemoState;
        if (s.version === DEMO_VERSION) return s;
      }
    } catch {
      /* fall through to a fresh seed */
    }
    const s = buildSeed();
    save(s, false);
    return s;
  };
  function save(s: DemoState, broadcast = true) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(s));
    } catch {
      throw new Error('Demo storage is full. Use "Reset demo data" on the sign-in page.');
    }
    if (broadcast) {
      channel?.postMessage('changed');
      notify();
    }
  }
  /** Runs a mutation on a copy of the state and commits it only if it does not throw (atomic). */
  const tx = <T>(fn: (s: DemoState) => T): T => {
    const s = load();
    const result = fn(s);
    save(s);
    return result;
  };

  const sessionId = () => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  };
  const me = (s: DemoState): Profile => {
    const id = sessionId();
    const p = id ? s.profiles.find((x) => x.id === id) : undefined;
    if (!p) throw new Error('Please sign in');
    return p;
  };
  const requireRole = (s: DemoState, role: Role) => {
    const p = me(s);
    if (p.role !== role) throw new Error(`Only ${role}s can do this`);
    return p;
  };
  const setSession = (id: string | null) => {
    try {
      if (id) sessionStorage.setItem(SESSION_KEY, id);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    authListeners.forEach((l) => l());
  };

  const activeJobs = (s: DemoState, resolverId: string) =>
    s.issues.filter((i) => i.assigned_to === resolverId && ['assigned', 'pending_audit', 'needs_review'].includes(i.status)).length;

  const autoAssign = (s: DemoState, issue: Issue) => {
    const candidates = s.profiles
      .filter((p) => p.role === 'resolver' && p.department_id === issue.department_id)
      .sort((a, b) => activeJobs(s, a.id) - activeJobs(s, b.id));
    if (candidates[0]) {
      issue.assigned_to = candidates[0].id;
      issue.assigned_at = nowIso();
      issue.status = 'assigned';
    } else issue.status = 'open';
  };

  const releasePayment = (s: DemoState, issue: Issue, auditId: string) => {
    if (issue.status === 'verified') throw new Error('Already paid');
    if (!issue.assigned_to || issue.bounty == null) throw new Error('Nothing to pay');
    const fee = round2(issue.bounty * s.treasury.fee_rate);
    if (s.treasury.balance < issue.bounty + fee) throw new Error('Insufficient treasury balance');
    const nextId = () => (s.ledger[0]?.id ?? 0) + 1;
    s.treasury.balance = round2(s.treasury.balance - issue.bounty);
    s.profiles.find((p) => p.id === issue.assigned_to)!.wallet_balance = round2(
      s.profiles.find((p) => p.id === issue.assigned_to)!.wallet_balance + issue.bounty,
    );
    s.ledger.unshift({ id: nextId(), created_at: nowIso(), kind: 'payout', amount: issue.bounty, issue_id: issue.id, audit_id: auditId, profile_id: issue.assigned_to, treasury_balance_after: s.treasury.balance, note: 'Payout for verified repair' });
    if (fee > 0) {
      s.treasury.balance = round2(s.treasury.balance - fee);
      s.ledger.unshift({ id: nextId(), created_at: nowIso(), kind: 'platform_fee', amount: fee, issue_id: issue.id, audit_id: auditId, profile_id: null, treasury_balance_after: s.treasury.balance, note: 'Auracity platform fee' });
    }
    issue.status = 'verified';
    issue.verified_at = nowIso();
    const reporter = s.profiles.find((p) => p.id === issue.reporter_id);
    if (reporter) reporter.points += POINTS_ISSUE_FIXED;
  };

  return {
    mode: 'demo',

    async currentProfile() {
      const id = sessionId();
      return id ? (load().profiles.find((p) => p.id === id) ?? null) : null;
    },
    async signIn() {
      throw new Error('Demo mode: pick a demo account below.');
    },
    async signUp(_email, _password, fullName) {
      const id = `u-${uuid().slice(0, 8)}`;
      tx((s) => s.profiles.push({ id, full_name: fullName || 'New citizen', role: 'citizen', department_id: null, points: 0, wallet_balance: 0 }));
      setSession(id);
    },
    async signOut() {
      setSession(null);
    },
    onAuthChange(cb) {
      authListeners.add(cb);
      return () => authListeners.delete(cb);
    },

    async listDepartments() {
      return load().departments;
    },
    async listProfiles() {
      return load().profiles;
    },
    async listIssues() {
      return [...load().issues].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async myUpvotes() {
      const id = sessionId();
      return new Set(load().upvotes.filter((u) => u.user_id === id).map((u) => u.issue_id));
    },
    async listAudits(issueId) {
      const s = load();
      const p = me(s);
      return s.audits.filter((a) => {
        if (issueId && a.issue_id !== issueId) return false;
        if (p.role === 'admin' || a.resolver_id === p.id) return true;
        return s.issues.some((i) => i.id === a.issue_id && i.reporter_id === p.id);
      });
    },
    async getTreasury() {
      return load().treasury;
    },
    async listLedger() {
      return load().ledger;
    },
    async resolverStats() {
      const s = load();
      return s.profiles
        .filter((p) => p.role === 'resolver')
        .map((p) => {
          const ratings = s.audits.filter((a) => a.resolver_id === p.id).map((a) => a.rating);
          return {
            id: p.id, full_name: p.full_name, department_id: p.department_id, wallet_balance: p.wallet_balance,
            active_jobs: activeJobs(s, p.id),
            completed_jobs: s.issues.filter((i) => i.assigned_to === p.id && i.status === 'verified').length,
            avg_rating: ratings.length ? round2(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null,
          };
        });
    },
    async cityMood(): Promise<MoodSummary> {
      const since = Date.now() - MOOD_WINDOW_MS;
      const latest = new Map<string, Mood>();
      for (const v of [...load().moods].sort((a, b) => a.created_at.localeCompare(b.created_at)))
        if (new Date(v.created_at).getTime() > since) latest.set(v.user_id, v.mood);
      const counts = { happy: 0, calm: 0, concerned: 0, angry: 0 } as Record<Mood, number>;
      latest.forEach((m) => counts[m]++);
      const total = latest.size;
      const majority = total ? (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as Mood) : null;
      return { counts, total, majority };
    },
    async myMood() {
      const id = sessionId();
      const since = Date.now() - MOOD_WINDOW_MS;
      const mine = load().moods.filter((v) => v.user_id === id && new Date(v.created_at).getTime() > since);
      return mine.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.mood ?? null;
    },

    async reportIssue(r) {
      const photo = await blobToDataUrl(await compressImage(r.photo, 640, 0.6));
      const issue = tx((s) => {
        const p = me(s);
        const i: Issue = {
          id: uuid(), created_at: nowIso(), reporter_id: p.id, lat: r.lat, lng: r.lng, address: r.address ?? null,
          description: r.description, before_photo_url: photo, after_photo_url: null, status: 'classifying',
          category: null, department_id: null, summary: null, severity: null, ai_confidence: null, bounty: null,
          upvotes: 0, assigned_to: null, assigned_at: null, resolved_at: null, verified_at: null,
        };
        s.issues.push(i);
        return i;
      });

      await sleep(1400); // "Vision AI" thinking

      return tx((s) => {
        const i = s.issues.find((x) => x.id === issue.id)!;
        const text = r.description;
        if (NOT_CIVIC.test(text)) {
          i.status = 'invalid';
          i.summary = 'This does not look like a public civic issue.';
          i.ai_confidence = 0.8;
          return i;
        }
        const match = KEYWORDS.find((k) => k.re.test(text));
        const dept = s.departments.find((d) => d.code === (match?.dept ?? 'general'))!;
        const severity = Math.min(5, (match?.severity ?? 2) + (DANGER.test(text) ? 1 : 0));
        i.category = match?.category ?? 'General civic issue';
        i.department_id = dept.id;
        i.severity = severity;
        i.ai_confidence = match ? 0.82 : 0.55;
        i.summary = (text.trim() ? text.trim().replace(/\s+/g, ' ').slice(0, 140) : i.category) + (r.address ? ` (${r.address})` : '');
        i.bounty = computeBounty(dept.base_bounty, severity);
        const reporter = s.profiles.find((p) => p.id === i.reporter_id);
        if (reporter) reporter.points += POINTS_VALID_REPORT;
        autoAssign(s, i);
        return i;
      });
    },

    async submitResolution(issueId, photoFile) {
      const photo = await blobToDataUrl(await compressImage(photoFile, 640, 0.6));
      const before = tx((s) => {
        const p = me(s);
        const i = s.issues.find((x) => x.id === issueId);
        if (!i) throw new Error('Issue not found');
        if (i.assigned_to !== p.id) throw new Error('Not your job');
        if (i.status !== 'assigned') throw new Error('Job is not open for resolution');
        i.status = 'pending_audit';
        i.after_photo_url = photo;
        i.resolved_at = nowIso();
        return i.before_photo_url;
      });

      // Demo auditor: compares image fingerprints instead of a vision model.
      const [{ difference, correlation }] = await Promise.all([compareImages(before, photo), sleep(1600)]);
      let rating: number, confidence: number, legit: boolean, reasoning: string;
      if (difference < 0.004 && correlation > 0.995) {
        rating = 1; confidence = 0.95; legit = false;
        reasoning = 'The after photo is nearly identical to the before photo. No repair is visible.';
      } else if (correlation < 0.15 && difference > 0.3) {
        rating = 3; confidence = 0.55; legit = true;
        reasoning = 'The scene changed a lot. The fix may be real, but the auditor cannot confirm this is the same location.';
      } else {
        rating = Math.min(5, 3 + (difference > 0.08 ? 1 : 0) + (correlation > 0.5 ? 1 : 0));
        confidence = round2(0.75 + Math.min(0.2, correlation * 0.2));
        legit = true;
        reasoning = 'Same location (overall layout matches) and the reported area has visibly changed, consistent with a repair.';
      }

      return tx((s) => {
        const i = s.issues.find((x) => x.id === issueId)!;
        let decision: Audit['decision'] =
          confidence < AUDIT_MIN_CONFIDENCE ? 'needs_review' : legit && rating >= AUDIT_MIN_RATING ? 'approved' : 'rejected';
        if (decision === 'approved' && s.treasury.balance < (i.bounty ?? 0) * (1 + s.treasury.fee_rate)) {
          decision = 'needs_review';
          reasoning += ' [Held: treasury balance too low for payout]';
        }
        const audit: Audit = {
          id: uuid(), created_at: nowIso(), issue_id: i.id, resolver_id: i.assigned_to!, rating, confidence,
          is_legit: legit, reasoning, model: 'demo-heuristic-auditor', decision,
          reviewed_by: null, review_note: null, reviewed_at: null,
        };
        s.audits.unshift(audit);
        if (decision === 'approved') releasePayment(s, i, audit.id);
        else if (decision === 'needs_review') i.status = 'needs_review';
        else {
          i.status = 'assigned';
          i.after_photo_url = null;
          i.resolved_at = null;
        }
        return audit;
      });
    },

    async toggleUpvote(issueId, on) {
      tx((s) => {
        const p = me(s);
        s.upvotes = s.upvotes.filter((u) => !(u.issue_id === issueId && u.user_id === p.id));
        if (on) s.upvotes.push({ issue_id: issueId, user_id: p.id });
        const i = s.issues.find((x) => x.id === issueId);
        if (i) i.upvotes = s.upvotes.filter((u) => u.issue_id === issueId).length;
      });
    },
    async voteMood(mood) {
      tx((s) => {
        const p = me(s);
        s.moods.push({ user_id: p.id, mood, created_at: nowIso() });
        const since = Date.now() - MOOD_WINDOW_MS;
        s.moods = s.moods.filter((v) => new Date(v.created_at).getTime() > since);
      });
    },
    async aurabot(messages: ChatMessage[], role) {
      await sleep(500);
      return demoBotReply(messages[messages.length - 1]?.content ?? '', role);
    },

    async reviewAudit(auditId, approve, note) {
      tx((s) => {
        const admin = requireRole(s, 'admin');
        const a = s.audits.find((x) => x.id === auditId);
        if (!a) throw new Error('Audit not found');
        if (a.decision !== 'needs_review' || a.reviewed_at) throw new Error('Audit does not need review');
        const i = s.issues.find((x) => x.id === a.issue_id)!;
        a.decision = approve ? 'admin_approved' : 'admin_rejected';
        a.reviewed_by = admin.id;
        a.review_note = note ?? null;
        a.reviewed_at = nowIso();
        if (approve) releasePayment(s, i, a.id);
        else {
          i.status = 'assigned';
          i.after_photo_url = null;
          i.resolved_at = null;
        }
      });
    },
    async assignIssue(issueId, resolverId) {
      tx((s) => {
        requireRole(s, 'admin');
        const i = s.issues.find((x) => x.id === issueId);
        if (!i || !['open', 'assigned'].includes(i.status)) throw new Error('Issue cannot be reassigned in its current state');
        if (!s.profiles.some((p) => p.id === resolverId && p.role === 'resolver')) throw new Error('Not a resolver');
        i.assigned_to = resolverId;
        i.assigned_at = nowIso();
        i.status = 'assigned';
      });
    },
    async topUpBudget(amount, note) {
      tx((s) => {
        const admin = requireRole(s, 'admin');
        if (!(amount > 0)) throw new Error('Amount must be positive');
        s.treasury.balance = round2(s.treasury.balance + amount);
        s.ledger.unshift({ id: (s.ledger[0]?.id ?? 0) + 1, created_at: nowIso(), kind: 'budget_topup', amount, issue_id: null, audit_id: null, profile_id: admin.id, treasury_balance_after: s.treasury.balance, note: note || 'Repair budget top-up' });
      });
    },
    async setUserRole(userId, role, departmentCode) {
      tx((s) => {
        requireRole(s, 'admin');
        const p = s.profiles.find((x) => x.id === userId);
        if (!p) throw new Error('User not found');
        p.role = role;
        p.department_id = role === 'resolver' ? (s.departments.find((d) => d.code === departmentCode)?.id ?? null) : null;
      });
    },

    subscribe(cb) {
      listeners.add(cb);
      const poll = setInterval(cb, 60_000);
      return () => {
        listeners.delete(cb);
        clearInterval(poll);
      };
    },

    demo: {
      users: () => load().profiles,
      signInAs: (id) => setSession(id),
      reset: () => {
        save(buildSeed());
        setSession(null);
      },
    },
  };
}

function demoBotReply(q: string, role: Role): string {
  const t = q.toLowerCase();
  if (/hi|hello|hey|namaste/.test(t) && t.length < 20)
    return `Namaste! I'm AuraBot. Ask me how to report an issue, what the pin colours mean, how points work, or how payments are verified.`;
  if (/colou?r|pins? |map|green|red|amber|grey/.test(t))
    return 'Pin colours: grey = AI is classifying, red = open or assigned to a worker, amber = repair under AI audit or admin review, green = fixed and verified. Pins update live on every device.';
  if (/report|complain|photo|pin/.test(t))
    return 'Tap "Report" → take or upload a photo → drag the pin to the exact spot → add a short note → Submit. The Vision AI picks the department and a worker within seconds. Valid reports earn you 10 points.';
  if (/point|leader|reward|earn/.test(t))
    return 'You get 10 points for every valid report and 5 more when it is fixed and verified. Check the Leaderboard to see top reporters in your city.';
  if (/upvote|priority|vote/.test(t) && !/mood/.test(t))
    return 'Upvote an issue you also face. More upvotes push it higher in the admin priority list. You can upvote once per issue.';
  if (/mood/.test(t))
    return 'City Mood shows the majority mood from citizen votes in the last 2 hours. Your latest vote counts. Tap an emoji on the map screen to vote.';
  if (/pay|money|wallet|audit|treasury|ledger|transparen/.test(t))
    return role === 'resolver'
      ? 'Upload a clear "after" photo from the same spot as the original. The AI compares before and after and rates 1–5. Rating ≥ 3 with ≥ 70% confidence releases the bounty straight to your wallet. Unsure cases go to an admin.'
      : 'Every payout moves from the city treasury to the worker\'s wallet only after the AI verifies the repair. Each transaction is written to an append-only ledger. See it on the Transparency page.';
  if (/job|fix|resolve|after/.test(t))
    return 'Resolvers see only their assigned jobs under "My Jobs". Open a job, fix it, then upload the after photo. The audit runs immediately.';
  if (/emergenc|fire|accident|live wire|shock/.test(t))
    return 'For emergencies like fire, accidents or live wires, call 112 right away. Then report it here so the department can follow up.';
  return 'I can help with reporting issues, pin colours, points and upvotes, City Mood, and how repairs are verified and paid. What would you like to know? (Demo mode: answers are scripted. Connect Supabase + Groq for the live AI.)';
}
