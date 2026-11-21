import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Api } from './api';
import type { Audit, Issue, Mood, MoodSummary, Profile } from './types';
import { compressImage } from './image';

const num = <T extends object>(row: T, keys: (keyof T)[]): T => {
  const out = { ...row };
  for (const k of keys) if (out[k] != null) (out as Record<keyof T, unknown>)[k] = Number(out[k]);
  return out;
};

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb = createClient(url, anonKey);

  const uid = async () => {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('Please sign in');
    return id;
  };
  const check = <T>(res: { data: T | null; error: { message: string } | null }): T => {
    if (res.error) throw new Error(res.error.message);
    return res.data as T;
  };
  const must = (res: { error: { message: string } | null }) => {
    if (res.error) throw new Error(res.error.message);
  };
  const invoke = async <T>(fn: string, body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await sb.functions.invoke(fn, { body });
    if (error) {
      let msg = error.message;
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx) msg = (await ctx.json()).error ?? msg;
      } catch {}
      throw new Error(msg);
    }
    return data as T;
  };
  const upload = async (file: File, folder: string) => {
    const id = await uid();
    const blob = await compressImage(file);
    const path = `${id}/${folder}/${crypto.randomUUID()}.jpg`;
    check(await sb.storage.from('issue-photos').upload(path, blob, { contentType: 'image/jpeg' }));
    return sb.storage.from('issue-photos').getPublicUrl(path).data.publicUrl;
  };
  const issueNum = (i: Issue) => num(i, ['bounty', 'ai_confidence']);

  return {
    mode: 'supabase',

    async currentProfile() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      const res = await sb.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle();
      return res.data ? num(res.data as Profile, ['wallet_balance']) : null;
    },
    async signIn(email, password) {
      must(await sb.auth.signInWithPassword({ email, password }));
    },
    async signUp(email, password, fullName) {
      const res = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      must(res);
      if (!res.data.session) throw new Error('Check your email to confirm your account, then sign in.');
    },
    async signOut() {
      await sb.auth.signOut();
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },

    async listDepartments() {
      return check(await sb.from('departments').select('*').order('name')).map((d) => num(d, ['base_bounty']));
    },
    async listProfiles() {
      return check(await sb.from('profiles').select('*')).map((p) => num(p as Profile, ['wallet_balance']));
    },
    async listIssues() {
      return check(await sb.from('issues').select('*').order('created_at', { ascending: false }).limit(1000)).map(issueNum);
    },
    async myUpvotes() {
      const id = await uid();
      return new Set(check(await sb.from('upvotes').select('issue_id').eq('user_id', id)).map((r) => r.issue_id as string));
    },
    async listAudits(issueId) {
      let q = sb.from('audits').select('*').order('created_at', { ascending: false });
      if (issueId) q = q.eq('issue_id', issueId);
      return check(await q).map((a) => num(a as Audit, ['confidence']));
    },
    async getTreasury() {
      const t = check(await sb.from('treasury').select('balance, fee_rate').eq('id', 1).single()) as { balance: number; fee_rate: number };
      return { balance: Number(t.balance), fee_rate: Number(t.fee_rate) };
    },
    async listLedger() {
      return check(await sb.from('ledger').select('*').order('id', { ascending: false }).limit(500)).map((l) =>
        num(l, ['amount', 'treasury_balance_after']),
      );
    },
    async resolverStats() {
      return check(await sb.rpc('resolver_stats')).map((r: Record<string, unknown>) => ({
        ...(r as object),
        wallet_balance: Number(r.wallet_balance),
        active_jobs: Number(r.active_jobs),
        completed_jobs: Number(r.completed_jobs),
        avg_rating: r.avg_rating == null ? null : Number(r.avg_rating),
      })) as never;
    },
    async cityMood(): Promise<MoodSummary> {
      const rows = check(await sb.rpc('city_mood')) as { mood: Mood; votes: number }[];
      const counts = { happy: 0, calm: 0, concerned: 0, angry: 0 } as Record<Mood, number>;
      for (const r of rows) counts[r.mood] = Number(r.votes);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const majority = total ? (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as Mood) : null;
      return { counts, total, majority };
    },
    async myMood() {
      const id = await uid();
      const since = new Date(Date.now() - 2 * 3600_000).toISOString();
      const rows = check(
        await sb.from('mood_votes').select('mood').eq('user_id', id).gt('created_at', since).order('created_at', { ascending: false }).limit(1),
      );
      return (rows[0]?.mood as Mood) ?? null;
    },

    async reportIssue(r) {
      const photoUrl = await upload(r.photo, 'before');
      const issue = check(
        await sb
          .from('issues')
          .insert({ lat: r.lat, lng: r.lng, description: r.description, address: r.address ?? null, before_photo_url: photoUrl })
          .select('*')
          .single(),
      ) as Issue;
      const res = await invoke<{ issue: Issue }>('classify-issue', { issue_id: issue.id });
      return issueNum(res.issue);
    },
    async submitResolution(issueId, photo) {
      const photoUrl = await upload(photo, 'after');
      check(await sb.rpc('submit_resolution', { p_issue: issueId, p_after_photo_url: photoUrl }));
      const res = await invoke<{ audit: Audit }>('audit-resolution', { issue_id: issueId });
      return num(res.audit, ['confidence']);
    },

    async toggleUpvote(issueId, on) {
      const id = await uid();
      if (on) check(await sb.from('upvotes').insert({ issue_id: issueId, user_id: id }));
      else check(await sb.from('upvotes').delete().eq('issue_id', issueId).eq('user_id', id));
    },
    async voteMood(mood) {
      const id = await uid();
      check(await sb.from('mood_votes').insert({ mood, user_id: id }));
    },
    async aurabot(messages, role) {
      return (await invoke<{ reply: string }>('aurabot', { messages, role })).reply;
    },

    async reviewAudit(auditId, approve, note) {
      check(await sb.rpc('review_audit', { p_audit: auditId, p_approve: approve, p_note: note ?? null }));
    },
    async assignIssue(issueId, resolverId) {
      check(await sb.rpc('assign_issue', { p_issue: issueId, p_resolver: resolverId }));
    },
    async topUpBudget(amount, note) {
      check(await sb.rpc('topup_budget', { p_amount: amount, p_note: note ?? null }));
    },
    async setUserRole(userId, role, departmentCode) {
      check(await sb.rpc('set_user_role', { p_user: userId, p_role: role, p_department_code: departmentCode ?? null }));
    },

    subscribe(cb) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const fire = () => {
        clearTimeout(timer);
        timer = setTimeout(cb, 150);
      };
      const channel: RealtimeChannel = sb.channel(`auracity-${crypto.randomUUID()}`);
      for (const table of ['issues', 'audits', 'ledger', 'treasury', 'mood_votes', 'upvotes', 'profiles']) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, fire);
      }
      channel.subscribe();
      const poll = setInterval(cb, 60_000);
      return () => {
        clearTimeout(timer);
        clearInterval(poll);
        void sb.removeChannel(channel);
      };
    },
  };
}
