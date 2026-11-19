// On-device backend: the whole Report → Classify → Resolve → Audit → Pay pipeline, stored on the phone.
// AI steps call Groq when EXPO_PUBLIC_GROQ_API_KEY is set, otherwise a simple offline fallback runs.
// Every mutation runs on a copy of the state and is saved only if it succeeds (atomic, like the SQL version).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildSeed, STATE_VERSION } from './seed';
import {
  AUDIT_MIN_CONFIDENCE, AUDIT_MIN_RATING, computeBounty, MOOD_WINDOW_MS, POINTS_ISSUE_FIXED, POINTS_VALID_REPORT,
} from './rules';
import * as groq from './groq';
import { compress, fingerprint, persist, toBase64 } from './photos';

const STATE_KEY = 'auracity-state';
const SESSION_KEY = 'auracity-session';

let state = null;
let sessionId = null;
let ready = null;
const listeners = new Set();
const authListeners = new Set();

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nowIso = () => new Date().toISOString();
const round2 = (n) => Math.round(n * 100) / 100;
const clone = (x) => JSON.parse(JSON.stringify(x));

function init() {
  if (!ready)
    ready = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STATE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        state = parsed && parsed.version === STATE_VERSION ? parsed : buildSeed();
      } catch {
        state = buildSeed();
      }
      try {
        sessionId = await AsyncStorage.getItem(SESSION_KEY);
      } catch {
        sessionId = null;
      }
    })();
  return ready;
}

async function tx(fn) {
  await init();
  const draft = clone(state);
  const result = fn(draft);
  state = draft;
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
  return result;
}

async function read() {
  await init();
  return state;
}

function me(s) {
  const p = s.profiles.find((x) => x.id === sessionId);
  if (!p) throw new Error('Please sign in');
  return p;
}
function requireRole(s, role) {
  const p = me(s);
  if (p.role !== role) throw new Error(`Only ${role}s can do this`);
  return p;
}
const activeJobs = (s, id) =>
  s.issues.filter((i) => i.assigned_to === id && ['assigned', 'pending_audit', 'needs_review'].includes(i.status)).length;

function autoAssign(s, issue) {
  const [best] = s.profiles
    .filter((p) => p.role === 'resolver' && p.department_id === issue.department_id)
    .sort((a, b) => activeJobs(s, a.id) - activeJobs(s, b.id));
  if (best) {
    issue.assigned_to = best.id;
    issue.assigned_at = nowIso();
    issue.status = 'assigned';
  } else issue.status = 'open';
}

/** Treasury → wallet, plus platform fee, plus ledger rows. Throws (and nothing is saved) if funds are short. */
function releasePayment(s, issue, auditId) {
  if (issue.status === 'verified') throw new Error('Already paid');
  const fee = round2(issue.bounty * s.treasury.fee_rate);
  if (s.treasury.balance < issue.bounty + fee) throw new Error('Insufficient treasury balance');
  const nextId = () => (s.ledger[0]?.id ?? 0) + 1;
  const worker = s.profiles.find((p) => p.id === issue.assigned_to);
  s.treasury.balance = round2(s.treasury.balance - issue.bounty);
  worker.wallet_balance = round2(worker.wallet_balance + issue.bounty);
  s.ledger.unshift({ id: nextId(), created_at: nowIso(), kind: 'payout', amount: issue.bounty, issue_id: issue.id, audit_id: auditId, profile_id: worker.id, treasury_balance_after: s.treasury.balance, note: 'Payout for verified repair' });
  if (fee > 0) {
    s.treasury.balance = round2(s.treasury.balance - fee);
    s.ledger.unshift({ id: nextId(), created_at: nowIso(), kind: 'platform_fee', amount: fee, issue_id: issue.id, audit_id: auditId, profile_id: null, treasury_balance_after: s.treasury.balance, note: 'Auracity platform fee' });
  }
  issue.status = 'verified';
  issue.verified_at = nowIso();
  const reporter = s.profiles.find((p) => p.id === issue.reporter_id);
  if (reporter) reporter.points += POINTS_ISSUE_FIXED;
}

// ---------- Offline fallbacks (used only when no Groq key is configured) ----------
const KEYWORDS = [
  { re: /pothole|crater|road|asphalt|footpath|divider/i, dept: 'roads', category: 'Pothole / road damage', severity: 3 },
  { re: /leak|pipe|water|drain|sewer|flood|logging/i, dept: 'water', category: 'Water leak / drainage', severity: 3 },
  { re: /light|lamp|wire|electric|pole|transformer|power|spark/i, dept: 'electricity', category: 'Electrical fault', severity: 3 },
  { re: /garbage|trash|waste|dump|litter|smell|bin|dirty/i, dept: 'sanitation', category: 'Garbage dump', severity: 2 },
  { re: /tree|park|branch|garden|bench|grass/i, dept: 'parks', category: 'Park / tree issue', severity: 2 },
];
function offlineClassify(note) {
  const k = KEYWORDS.find((x) => x.re.test(note));
  return {
    is_civic_issue: true,
    category: k?.category ?? 'General civic issue',
    department: k?.dept ?? 'general',
    summary: note.trim() || k?.category || 'Civic issue reported',
    severity: Math.min(5, (k?.severity ?? 2) + (/danger|accident|spark|child|urgent|deep/i.test(note) ? 1 : 0)),
    confidence: k ? 0.8 : 0.55,
  };
}
async function offlineAudit(beforeRef, afterRef) {
  const [a, b] = await Promise.all([fingerprint(beforeRef), fingerprint(afterRef)]);
  if (a === b)
    return { rating: 1, confidence: 0.95, is_legit: false, reasoning: 'The after photo is identical to the before photo. No repair is visible.', model: 'offline check' };
  return { rating: 4, confidence: 0.75, is_legit: true, reasoning: 'Offline check: the after photo differs from the before photo. Connect the AI for a full visual audit.', model: 'offline check' };
}

// ---------- Public API ----------
export const api = {
  aiEnabled: groq.hasGroq,
  aiModel: groq.hasGroq ? groq.VISION_MODEL : 'offline',

  async currentProfile() {
    const s = await read();
    return s.profiles.find((p) => p.id === sessionId) ?? null;
  },
  async users() {
    return (await read()).profiles;
  },
  async signInAs(id) {
    await init();
    sessionId = id;
    await AsyncStorage.setItem(SESSION_KEY, id);
    authListeners.forEach((l) => l());
  },
  async signUp(fullName) {
    const id = `u-${uid()}`;
    await tx((s) => s.profiles.push({ id, full_name: fullName.trim() || 'New citizen', role: 'citizen', department_id: null, points: 0, wallet_balance: 0 }));
    await api.signInAs(id);
  },
  async signOut() {
    sessionId = null;
    await AsyncStorage.removeItem(SESSION_KEY);
    authListeners.forEach((l) => l());
  },
  async resetAll() {
    state = buildSeed();
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
    await api.signOut();
    listeners.forEach((l) => l());
  },
  onAuthChange(cb) {
    authListeners.add(cb);
    return () => authListeners.delete(cb);
  },
  subscribe(cb) {
    listeners.add(cb);
    const t = setInterval(cb, 60_000); // City Mood window keeps moving
    return () => {
      listeners.delete(cb);
      clearInterval(t);
    };
  },

  async listDepartments() {
    return (await read()).departments;
  },
  async listProfiles() {
    return (await read()).profiles;
  },
  async listIssues() {
    return [...(await read()).issues].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async getIssue(id) {
    return (await read()).issues.find((i) => i.id === id) ?? null;
  },
  async myUpvotes() {
    return new Set((await read()).upvotes.filter((u) => u.user_id === sessionId).map((u) => u.issue_id));
  },
  async listAudits(issueId) {
    return (await read()).audits.filter((a) => !issueId || a.issue_id === issueId);
  },
  async getTreasury() {
    return (await read()).treasury;
  },
  async listLedger() {
    return (await read()).ledger;
  },
  async resolverStats() {
    const s = await read();
    return s.profiles
      .filter((p) => p.role === 'resolver')
      .map((p) => {
        const ratings = s.audits.filter((a) => a.resolver_id === p.id).map((a) => a.rating);
        return {
          ...p,
          active_jobs: activeJobs(s, p.id),
          completed_jobs: s.issues.filter((i) => i.assigned_to === p.id && i.status === 'verified').length,
          avg_rating: ratings.length ? round2(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null,
        };
      });
  },
  async cityMood() {
    const since = Date.now() - MOOD_WINDOW_MS;
    const latest = new Map();
    for (const v of [...(await read()).moods].sort((a, b) => a.created_at.localeCompare(b.created_at)))
      if (new Date(v.created_at).getTime() > since) latest.set(v.user_id, v.mood);
    const counts = { happy: 0, calm: 0, concerned: 0, angry: 0 };
    latest.forEach((m) => counts[m]++);
    const total = latest.size;
    const majority = total ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : null;
    const mine = latest.get(sessionId) ?? null;
    return { counts, total, majority, mine };
  },

  /** Step 1 + 2: save the report, then classify it with the vision AI and auto-assign a worker. */
  async reportIssue({ photoUri, lat, lng, description, address }) {
    const small = await compress(photoUri, 1024, 0.7);
    const photo = persist(small.uri, small.base64);
    const issue = await tx((s) => {
      const p = me(s);
      const i = {
        id: uid(), created_at: nowIso(), reporter_id: p.id, lat, lng, address: address || null, description,
        before_photo_url: photo, after_photo_url: null, status: 'classifying', category: null, department_id: null,
        summary: null, severity: null, ai_confidence: null, bounty: null, upvotes: 0, assigned_to: null,
        assigned_at: null, resolved_at: null, verified_at: null,
      };
      s.issues.push(i);
      return i;
    });

    let c;
    try {
      c = groq.hasGroq ? await groq.classify(await toBase64(photo), description) : offlineClassify(description);
    } catch (e) {
      // Keep the report; fall back so the citizen is never stuck.
      c = { ...offlineClassify(description), summary: `${description || 'Civic issue'} (AI unavailable: ${e.message.slice(0, 60)})` };
    }

    return tx((s) => {
      const i = s.issues.find((x) => x.id === issue.id);
      if (!c.is_civic_issue) {
        i.status = 'invalid';
        i.summary = c.summary || 'This does not look like a public civic issue.';
        i.ai_confidence = c.confidence;
        return i;
      }
      const dept = s.departments.find((d) => d.code === c.department) ?? s.departments.find((d) => d.code === 'general');
      Object.assign(i, {
        category: c.category, department_id: dept.id, summary: c.summary, severity: c.severity,
        ai_confidence: c.confidence, bounty: computeBounty(dept.base_bounty, c.severity),
      });
      const reporter = s.profiles.find((p) => p.id === i.reporter_id);
      if (reporter) reporter.points += POINTS_VALID_REPORT;
      autoAssign(s, i);
      return i;
    });
  },

  /** Step 3 + 4: worker uploads the after photo, AI audits, payment released if approved. */
  async submitResolution(issueId, photoUri) {
    const small = await compress(photoUri, 1024, 0.7);
    const photo = persist(small.uri, small.base64);
    const issue = await tx((s) => {
      const p = me(s);
      const i = s.issues.find((x) => x.id === issueId);
      if (!i) throw new Error('Issue not found');
      if (i.assigned_to !== p.id) throw new Error('Not your job');
      if (i.status !== 'assigned') throw new Error('Job is not open for resolution');
      i.status = 'pending_audit';
      i.after_photo_url = photo;
      i.resolved_at = nowIso();
      return clone(i);
    });

    let r;
    try {
      r = groq.hasGroq
        ? await groq.audit(await toBase64(issue.before_photo_url), await toBase64(photo), `${issue.category} - ${issue.summary}`)
        : await offlineAudit(issue.before_photo_url, photo);
    } catch (e) {
      r = { rating: 3, confidence: 0, is_legit: false, reasoning: `AI audit failed (${e.message.slice(0, 80)}). Sent to an admin.`, model: groq.VISION_MODEL };
    }

    return tx((s) => {
      const i = s.issues.find((x) => x.id === issueId);
      let reasoning = r.reasoning;
      let decision =
        r.confidence < AUDIT_MIN_CONFIDENCE ? 'needs_review' : r.is_legit && r.rating >= AUDIT_MIN_RATING ? 'approved' : 'rejected';
      if (decision === 'approved' && s.treasury.balance < i.bounty * (1 + s.treasury.fee_rate)) {
        decision = 'needs_review';
        reasoning += ' [Held: treasury balance too low for payout]';
      }
      const audit = {
        id: uid(), created_at: nowIso(), issue_id: i.id, resolver_id: i.assigned_to, rating: r.rating, confidence: r.confidence,
        is_legit: r.is_legit, reasoning, model: r.model, decision, reviewed_by: null, review_note: null, reviewed_at: null,
      };
      s.audits.unshift(audit);
      if (decision === 'approved') releasePayment(s, i, audit.id);
      else if (decision === 'needs_review') i.status = 'needs_review';
      else Object.assign(i, { status: 'assigned', after_photo_url: null, resolved_at: null });
      return audit;
    });
  },

  async toggleUpvote(issueId, on) {
    await tx((s) => {
      const p = me(s);
      s.upvotes = s.upvotes.filter((u) => !(u.issue_id === issueId && u.user_id === p.id));
      if (on) s.upvotes.push({ issue_id: issueId, user_id: p.id });
      const i = s.issues.find((x) => x.id === issueId);
      if (i) i.upvotes = s.upvotes.filter((u) => u.issue_id === issueId).length;
    });
  },
  async voteMood(mood) {
    await tx((s) => {
      const p = me(s);
      const since = Date.now() - MOOD_WINDOW_MS;
      s.moods = s.moods.filter((v) => new Date(v.created_at).getTime() > since);
      s.moods.push({ user_id: p.id, mood, created_at: nowIso() });
    });
  },
  async aurabot(messages, role) {
    if (groq.hasGroq) return groq.botReply(messages, role);
    return 'AuraBot needs the AI connection. Ask your admin to add the Groq key to the build.';
  },

  async reviewAudit(auditId, approve, note) {
    await tx((s) => {
      const admin = requireRole(s, 'admin');
      const a = s.audits.find((x) => x.id === auditId);
      if (!a || a.decision !== 'needs_review' || a.reviewed_at) throw new Error('Audit does not need review');
      const i = s.issues.find((x) => x.id === a.issue_id);
      Object.assign(a, { decision: approve ? 'admin_approved' : 'admin_rejected', reviewed_by: admin.id, review_note: note || null, reviewed_at: nowIso() });
      if (approve) releasePayment(s, i, a.id);
      else Object.assign(i, { status: 'assigned', after_photo_url: null, resolved_at: null });
    });
  },
  async assignIssue(issueId, resolverId) {
    await tx((s) => {
      requireRole(s, 'admin');
      const i = s.issues.find((x) => x.id === issueId);
      if (!i || !['open', 'assigned'].includes(i.status)) throw new Error('Issue cannot be reassigned now');
      Object.assign(i, { assigned_to: resolverId, assigned_at: nowIso(), status: 'assigned' });
    });
  },
  async topUpBudget(amount) {
    await tx((s) => {
      const admin = requireRole(s, 'admin');
      if (!(amount > 0)) throw new Error('Enter a positive amount');
      s.treasury.balance = round2(s.treasury.balance + amount);
      s.ledger.unshift({ id: (s.ledger[0]?.id ?? 0) + 1, created_at: nowIso(), kind: 'budget_topup', amount, issue_id: null, audit_id: null, profile_id: admin.id, treasury_balance_after: s.treasury.balance, note: 'Repair budget top-up' });
    });
  },
  async setUserRole(userId, role, departmentId) {
    await tx((s) => {
      requireRole(s, 'admin');
      const p = s.profiles.find((x) => x.id === userId);
      p.role = role;
      p.department_id = role === 'resolver' ? departmentId || 'd-general' : null;
    });
  },
};
