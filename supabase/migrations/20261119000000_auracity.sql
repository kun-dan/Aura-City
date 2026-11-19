-- Auracity: schema, security policies and the report -> classify -> resolve -> audit -> pay chain.
-- All state changes to issues, wallets, treasury and ledger happen in SECURITY DEFINER
-- functions. Clients never update those tables directly.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('citizen', 'resolver', 'admin');
create type public.issue_status as enum (
  'classifying',   -- photo uploaded, waiting for the Vision AI
  'invalid',       -- AI decided this is not a civic issue
  'open',          -- classified, no resolver available yet
  'assigned',      -- a resolver owns the job
  'pending_audit', -- resolver uploaded the "after" photo
  'needs_review',  -- AI auditor unsure, an admin must decide
  'verified'       -- fix approved and resolver paid
);
create type public.mood as enum ('happy', 'calm', 'concerned', 'angry');
create type public.ledger_kind as enum ('budget_topup', 'payout', 'platform_fee');
create type public.audit_decision as enum ('approved', 'rejected', 'needs_review', 'admin_approved', 'admin_rejected');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  color text not null default '#7c5cff',
  base_bounty numeric(12,2) not null check (base_bounty > 0)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'citizen',
  department_id uuid references public.departments (id),
  points integer not null default 0,
  wallet_balance numeric(12,2) not null default 0 check (wallet_balance >= 0),
  created_at timestamptz not null default now()
);

create table public.treasury (
  id integer primary key default 1 check (id = 1),
  balance numeric(14,2) not null default 0 check (balance >= 0),
  fee_rate numeric(5,4) not null default 0.02 check (fee_rate >= 0 and fee_rate < 1),
  updated_at timestamptz not null default now()
);
insert into public.treasury (id, balance) values (1, 0);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_id uuid not null default auth.uid() references public.profiles (id),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  address text,
  description text not null default '',
  before_photo_url text not null,
  after_photo_url text,
  status public.issue_status not null default 'classifying',
  category text,
  department_id uuid references public.departments (id),
  summary text,
  severity smallint check (severity between 1 and 5),
  ai_confidence numeric(4,3),
  bounty numeric(12,2),
  upvotes integer not null default 0,
  assigned_to uuid references public.profiles (id),
  assigned_at timestamptz,
  resolved_at timestamptz,
  verified_at timestamptz
);
create index issues_status_idx on public.issues (status);
create index issues_assigned_idx on public.issues (assigned_to) where assigned_to is not null;

create table public.upvotes (
  issue_id uuid not null references public.issues (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (issue_id, user_id)
);

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  resolver_id uuid not null references public.profiles (id),
  rating smallint not null check (rating between 1 and 5),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  is_legit boolean not null,
  reasoning text not null,
  model text not null,
  decision public.audit_decision not null,
  reviewed_by uuid references public.profiles (id),
  review_note text,
  reviewed_at timestamptz
);
create index audits_issue_idx on public.audits (issue_id);

create table public.ledger (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  kind public.ledger_kind not null,
  amount numeric(12,2) not null check (amount > 0),
  issue_id uuid references public.issues (id),
  audit_id uuid references public.audits (id),
  profile_id uuid references public.profiles (id),
  treasury_balance_after numeric(14,2) not null,
  note text
);

create table public.mood_votes (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  mood public.mood not null,
  created_at timestamptz not null default now()
);
create index mood_votes_recent_idx on public.mood_votes (created_at desc);

-- ---------------------------------------------------------------------------
-- Seed departments
-- ---------------------------------------------------------------------------
insert into public.departments (code, name, color, base_bounty) values
  ('roads',       'Roads & Transport',  '#f97316', 2500),
  ('water',       'Water Supply',       '#0ea5e9', 1800),
  ('electricity', 'Electricity',        '#eab308', 1500),
  ('sanitation',  'Sanitation',         '#22c55e', 1000),
  ('parks',       'Parks & Gardens',    '#10b981', 1200),
  ('general',     'General Works',      '#a855f7', 1000);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_role_is(r public.user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = r);
$$;

-- New auth user -> citizen profile. Role is never read from client metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ledger and audits are append-only (decision fields on audits may be set once by review).
create or replace function public.forbid_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;

create trigger ledger_immutable before update or delete on public.ledger
  for each row execute function public.forbid_mutation();

create or replace function public.audits_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'audits are append-only';
  end if;
  if old.reviewed_at is not null
     or new.rating <> old.rating or new.confidence <> old.confidence
     or new.is_legit <> old.is_legit or new.reasoning <> old.reasoning
     or new.model <> old.model or new.issue_id <> old.issue_id then
    raise exception 'AI audit results cannot be changed';
  end if;
  return new;
end $$;

create trigger audits_immutable before update or delete on public.audits
  for each row execute function public.audits_guard();

-- Keep issues.upvotes in sync.
create or replace function public.sync_upvotes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update issues set upvotes = (select count(*) from upvotes where issue_id = coalesce(new.issue_id, old.issue_id))
  where id = coalesce(new.issue_id, old.issue_id);
  return null;
end $$;

create trigger upvotes_sync after insert or delete on public.upvotes
  for each row execute function public.sync_upvotes();

-- Bounty = department base x severity multiplier (0.8 .. 1.6).
create or replace function public.compute_bounty(p_base numeric, p_severity int)
returns numeric language sql immutable as $$
  select round(p_base * (0.6 + 0.2 * greatest(1, least(5, p_severity))), 2);
$$;

-- Pick the resolver in the department with the fewest active jobs.
create or replace function public.auto_assign(p_issue uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_dept uuid;
  v_resolver uuid;
begin
  select department_id into v_dept from issues where id = p_issue;
  select p.id into v_resolver
  from profiles p
  left join issues i on i.assigned_to = p.id and i.status in ('assigned', 'pending_audit', 'needs_review')
  where p.role = 'resolver' and p.department_id = v_dept
  group by p.id
  order by count(i.id), random()
  limit 1;

  if v_resolver is null then
    update issues set status = 'open' where id = p_issue;
  else
    update issues set status = 'assigned', assigned_to = v_resolver, assigned_at = now() where id = p_issue;
  end if;
  return v_resolver;
end $$;

-- ---------------------------------------------------------------------------
-- Pipeline step 2: classification (called by the classify-issue edge function)
-- ---------------------------------------------------------------------------
create or replace function public.apply_classification(
  p_issue uuid,
  p_is_civic_issue boolean,
  p_category text,
  p_department_code text,
  p_summary text,
  p_severity int,
  p_confidence numeric
) returns public.issues language plpgsql security definer set search_path = public as $$
declare
  v_issue issues;
  v_dept departments;
begin
  select * into v_issue from issues where id = p_issue for update;
  if not found then raise exception 'issue not found'; end if;
  if v_issue.status <> 'classifying' then raise exception 'issue already classified'; end if;

  if not p_is_civic_issue then
    update issues set status = 'invalid', summary = p_summary, ai_confidence = p_confidence
    where id = p_issue returning * into v_issue;
    return v_issue;
  end if;

  select * into v_dept from departments where code = p_department_code;
  if not found then select * into v_dept from departments where code = 'general'; end if;

  update issues set
    category = p_category,
    department_id = v_dept.id,
    summary = p_summary,
    severity = greatest(1, least(5, p_severity)),
    ai_confidence = p_confidence,
    bounty = compute_bounty(v_dept.base_bounty, p_severity)
  where id = p_issue;

  -- +10 points for a valid report
  update profiles set points = points + 10 where id = v_issue.reporter_id;

  perform auto_assign(p_issue);
  select * into v_issue from issues where id = p_issue;
  return v_issue;
end $$;

-- ---------------------------------------------------------------------------
-- Pipeline step 3: resolver submits the "after" photo
-- ---------------------------------------------------------------------------
create or replace function public.submit_resolution(p_issue uuid, p_after_photo_url text)
returns public.issues language plpgsql security definer set search_path = public as $$
declare
  v_issue issues;
begin
  select * into v_issue from issues where id = p_issue for update;
  if not found then raise exception 'issue not found'; end if;
  if v_issue.assigned_to is distinct from auth.uid() then raise exception 'not your job'; end if;
  if v_issue.status <> 'assigned' then raise exception 'job is not open for resolution'; end if;

  update issues set status = 'pending_audit', after_photo_url = p_after_photo_url, resolved_at = now()
  where id = p_issue returning * into v_issue;
  return v_issue;
end $$;

-- ---------------------------------------------------------------------------
-- Payment engine: treasury -> wallet, atomic, logged to the ledger.
-- Internal only (no EXECUTE for clients).
-- ---------------------------------------------------------------------------
create or replace function public.release_payment(p_issue uuid, p_audit uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_issue issues;
  v_treasury treasury;
  v_fee numeric(12,2);
begin
  select * into v_issue from issues where id = p_issue for update;
  if v_issue.status = 'verified' then raise exception 'already paid'; end if;
  if v_issue.assigned_to is null or v_issue.bounty is null then raise exception 'nothing to pay'; end if;

  select * into v_treasury from treasury where id = 1 for update;
  v_fee := round(v_issue.bounty * v_treasury.fee_rate, 2);
  if v_treasury.balance < v_issue.bounty + v_fee then
    raise exception 'insufficient treasury balance';
  end if;

  update treasury set balance = balance - v_issue.bounty, updated_at = now() where id = 1;
  update profiles set wallet_balance = wallet_balance + v_issue.bounty where id = v_issue.assigned_to;
  insert into ledger (kind, amount, issue_id, audit_id, profile_id, treasury_balance_after, note)
  values ('payout', v_issue.bounty, p_issue, p_audit, v_issue.assigned_to, v_treasury.balance - v_issue.bounty,
          'Payout for verified repair');

  if v_fee > 0 then
    update treasury set balance = balance - v_fee where id = 1;
    insert into ledger (kind, amount, issue_id, audit_id, treasury_balance_after, note)
    values ('platform_fee', v_fee, p_issue, p_audit, v_treasury.balance - v_issue.bounty - v_fee,
            'Auracity platform fee');
  end if;

  update issues set status = 'verified', verified_at = now() where id = p_issue;
  -- +5 points to the reporter when their issue is fixed
  update profiles set points = points + 5 where id = v_issue.reporter_id;
end $$;

-- ---------------------------------------------------------------------------
-- Pipeline step 4: AI audit result (called by the audit-resolution edge function)
-- Approve when legit, rating >= 3 and confidence >= 0.7.
-- Low confidence goes to an admin. Otherwise the job returns to the resolver.
-- ---------------------------------------------------------------------------
create or replace function public.record_audit(
  p_issue uuid,
  p_rating int,
  p_confidence numeric,
  p_is_legit boolean,
  p_reasoning text,
  p_model text
) returns public.audits language plpgsql security definer set search_path = public as $$
declare
  v_issue issues;
  v_audit audits;
  v_decision audit_decision;
  v_balance numeric;
begin
  select * into v_issue from issues where id = p_issue for update;
  if not found then raise exception 'issue not found'; end if;
  if v_issue.status <> 'pending_audit' then raise exception 'issue is not waiting for an audit'; end if;

  if p_confidence < 0.7 then
    v_decision := 'needs_review';
  elsif p_is_legit and p_rating >= 3 then
    v_decision := 'approved';
  else
    v_decision := 'rejected';
  end if;

  -- Not enough budget: hold for an admin rather than fail.
  if v_decision = 'approved' then
    select balance into v_balance from treasury where id = 1;
    if v_balance < v_issue.bounty * (1 + (select fee_rate from treasury where id = 1)) then
      v_decision := 'needs_review';
      p_reasoning := p_reasoning || ' [Held: treasury balance too low for payout]';
    end if;
  end if;

  insert into audits (issue_id, resolver_id, rating, confidence, is_legit, reasoning, model, decision)
  values (p_issue, v_issue.assigned_to, greatest(1, least(5, p_rating)), p_confidence, p_is_legit, p_reasoning, p_model, v_decision)
  returning * into v_audit;

  if v_decision = 'approved' then
    perform release_payment(p_issue, v_audit.id);
  elsif v_decision = 'needs_review' then
    update issues set status = 'needs_review' where id = p_issue;
  else
    update issues set status = 'assigned', after_photo_url = null, resolved_at = null where id = p_issue;
  end if;
  return v_audit;
end $$;

-- ---------------------------------------------------------------------------
-- Admin actions
-- ---------------------------------------------------------------------------
create or replace function public.review_audit(p_audit uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_audit audits;
begin
  if not current_role_is('admin') then raise exception 'admins only'; end if;
  select * into v_audit from audits where id = p_audit for update;
  if not found then raise exception 'audit not found'; end if;
  if v_audit.decision <> 'needs_review' or v_audit.reviewed_at is not null then
    raise exception 'audit does not need review';
  end if;

  update audits set
    decision = case when p_approve then 'admin_approved'::audit_decision else 'admin_rejected'::audit_decision end,
    reviewed_by = auth.uid(), review_note = p_note, reviewed_at = now()
  where id = p_audit;

  if p_approve then
    perform release_payment(v_audit.issue_id, p_audit);
  else
    update issues set status = 'assigned', after_photo_url = null, resolved_at = null where id = v_audit.issue_id;
  end if;
end $$;

create or replace function public.assign_issue(p_issue uuid, p_resolver uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not current_role_is('admin') then raise exception 'admins only'; end if;
  if not exists (select 1 from profiles where id = p_resolver and role = 'resolver') then
    raise exception 'not a resolver';
  end if;
  update issues set assigned_to = p_resolver, assigned_at = now(), status = 'assigned'
  where id = p_issue and status in ('open', 'assigned');
  if not found then raise exception 'issue cannot be reassigned in its current state'; end if;
end $$;

create or replace function public.topup_budget(p_amount numeric, p_note text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_balance numeric;
begin
  if not current_role_is('admin') then raise exception 'admins only'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  update treasury set balance = balance + p_amount, updated_at = now() where id = 1 returning balance into v_balance;
  insert into ledger (kind, amount, profile_id, treasury_balance_after, note)
  values ('budget_topup', p_amount, auth.uid(), v_balance, coalesce(p_note, 'Repair budget top-up'));
  return v_balance;
end $$;

create or replace function public.set_user_role(p_user uuid, p_role public.user_role, p_department_code text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not current_role_is('admin') then raise exception 'admins only'; end if;
  update profiles set
    role = p_role,
    department_id = case when p_role = 'resolver' then (select id from departments where code = p_department_code) else null end
  where id = p_user;
end $$;

-- ---------------------------------------------------------------------------
-- City Mood: majority of each user's latest vote in the last 2 hours
-- ---------------------------------------------------------------------------
create or replace function public.city_mood()
returns table (mood public.mood, votes bigint) language sql stable security definer set search_path = public as $$
  select m.mood, count(*) from (
    select distinct on (user_id) user_id, mood
    from mood_votes
    where created_at > now() - interval '2 hours'
    order by user_id, created_at desc
  ) m
  group by m.mood;
$$;

-- Resolver performance for the admin dashboard
create or replace function public.resolver_stats()
returns table (
  id uuid, full_name text, department_id uuid, wallet_balance numeric,
  active_jobs bigint, completed_jobs bigint, avg_rating numeric
) language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.department_id, p.wallet_balance,
    (select count(*) from issues i where i.assigned_to = p.id and i.status in ('assigned','pending_audit','needs_review')),
    (select count(*) from issues i where i.assigned_to = p.id and i.status = 'verified'),
    (select round(avg(a.rating), 2) from audits a where a.resolver_id = p.id)
  from profiles p where p.role = 'resolver'
  order by p.full_name;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.departments enable row level security;
alter table public.profiles    enable row level security;
alter table public.treasury    enable row level security;
alter table public.issues      enable row level security;
alter table public.upvotes     enable row level security;
alter table public.audits      enable row level security;
alter table public.ledger      enable row level security;
alter table public.mood_votes  enable row level security;

-- Transparency by design: signed-in users can read the map, the treasury and the ledger.
create policy "read departments" on public.departments for select to authenticated using (true);
create policy "read profiles"    on public.profiles    for select to authenticated using (true);
create policy "read treasury"    on public.treasury    for select to authenticated using (true);
create policy "read issues"      on public.issues      for select to authenticated using (true);
create policy "read upvotes"     on public.upvotes     for select to authenticated using (true);
create policy "read ledger"      on public.ledger      for select to authenticated using (true);

-- Audits: admins, the resolver involved, and the reporter.
create policy "read audits" on public.audits for select to authenticated using (
  current_role_is('admin')
  or resolver_id = auth.uid()
  or exists (select 1 from issues i where i.id = issue_id and i.reporter_id = auth.uid())
);

-- Citizens create issues (only the allowed columns, status starts as 'classifying').
create policy "report issue" on public.issues for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'classifying');

create policy "upvote" on public.upvotes for insert to authenticated with check (user_id = auth.uid());
create policy "remove upvote" on public.upvotes for delete to authenticated using (user_id = auth.uid());

create policy "vote mood" on public.mood_votes for insert to authenticated with check (user_id = auth.uid());
create policy "read own mood votes" on public.mood_votes for select to authenticated using (user_id = auth.uid());

create policy "update own name" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Column-level privileges: clients can only touch harmless columns.
revoke insert, update, delete on public.issues, public.profiles, public.treasury, public.ledger, public.audits from anon, authenticated;
grant insert (lat, lng, address, description, before_photo_url) on public.issues to authenticated;
grant update (full_name) on public.profiles to authenticated;
revoke insert, update, delete on public.upvotes, public.mood_votes from anon;
revoke update on public.upvotes, public.mood_votes from authenticated;

-- Function privileges
revoke execute on function public.release_payment(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.auto_assign(uuid) from public, anon, authenticated;
revoke execute on function public.apply_classification(uuid, boolean, text, text, text, int, numeric) from public, anon, authenticated;
revoke execute on function public.record_audit(uuid, int, numeric, boolean, text, text) from public, anon, authenticated;
grant execute on function public.apply_classification(uuid, boolean, text, text, text, int, numeric) to service_role;
grant execute on function public.record_audit(uuid, int, numeric, boolean, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: pins change color on every device
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.issues, public.audits, public.ledger, public.treasury, public.mood_votes, public.upvotes, public.profiles;

-- ---------------------------------------------------------------------------
-- Storage: photos (public read so they render on the map and the AI can fetch them)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('issue-photos', 'issue-photos', true)
on conflict (id) do nothing;

create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'issue-photos' and (storage.foldername(name))[1] = auth.uid()::text);
