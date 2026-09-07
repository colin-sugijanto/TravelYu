-- Migration 015: Subscription tiers + AI credit system
-- Plans: free / member / pro. Credits gate AI usage (intake, compare, generate, editor, regen, parse-booking).

do $$
begin
  create type public.plan_tier as enum ('free', 'member', 'pro');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.subscription_status as enum ('pending', 'active', 'cancelled', 'expired');
exception
  when duplicate_object then null;
end $$;

-- 1. Extend users with plan + credit balance
alter table public.users
  add column if not exists plan_tier public.plan_tier not null default 'free',
  add column if not exists ai_credits_balance integer not null default 30,
  add column if not exists ai_credits_quota integer not null default 30,
  add column if not exists ai_credits_period text not null default to_char(now(), 'YYYY-MM'),
  add column if not exists plan_expires_at timestamptz;

-- Backfill: existing users get free quota
update public.users
set ai_credits_quota = 30,
    ai_credits_balance = greatest(ai_credits_balance, 0)
where ai_credits_quota is null or ai_credits_quota = 0;

-- 2. Subscription plans catalog (source of truth, mirrored in src/lib/plans.ts)
create table if not exists public.subscription_plans (
  tier public.plan_tier primary key,
  name text not null,
  price_monthly_idr integer not null default 0,
  price_yearly_idr integer not null default 0,
  monthly_credits integer not null default 30,
  max_active_trips integer not null default 2,
  max_photos_per_trip integer not null default 10,
  max_bookings_per_trip integer not null default 3,
  max_group_members integer not null default 2,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true
);

insert into public.subscription_plans (tier, name, price_monthly_idr, price_yearly_idr, monthly_credits, max_active_trips, max_photos_per_trip, max_bookings_per_trip, max_group_members, features)
values
  ('free', 'Free', 0, 0, 30, 2, 10, 3, 2,
   '["30 AI credits / month", "Up to 2 active trips", "Ticket locker (3 bookings / trip)", "Memory wall (10 photos / trip)", "Shared trip link with branding"]'::jsonb),
  ('member', 'Member', 49000, 390000, 400, 20, 100, 50, 6,
   '["400 AI credits / month", "Up to 20 active trips", "Unlimited ticket locker", "Today Mode + expense tracker", "Memory scrapbook + Wrapped card", "PDF export tanpa watermark", "Group trip up to 6 orang", "Prioritas antrean AI"]'::jsonb),
  ('pro', 'Pro', 99000, 790000, 1200, 100, 500, 200, 15,
   '["1200 AI credits / month + 20% rollover", "Up to 100 active trips", "Shared family vault (15 anggota)", "Semua fitur Member", "Passport + creator share page", "CS prioritas + bantuan refund", "Akses awal fitur baru"]'::jsonb)
on conflict (tier) do update set
  name = excluded.name,
  price_monthly_idr = excluded.price_monthly_idr,
  price_yearly_idr = excluded.price_yearly_idr,
  monthly_credits = excluded.monthly_credits,
  max_active_trips = excluded.max_active_trips,
  max_photos_per_trip = excluded.max_photos_per_trip,
  max_bookings_per_trip = excluded.max_bookings_per_trip,
  max_group_members = excluded.max_group_members,
  features = excluded.features,
  is_active = true;

-- 3. User subscriptions (history + DOKU reconciliation)
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tier public.plan_tier not null,
  status public.subscription_status not null default 'pending',
  started_at timestamptz,
  expires_at timestamptz,
  auto_renew boolean not null default true,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  doku_invoice_no text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_subscriptions_user on public.user_subscriptions(user_id, created_at desc);
create index if not exists idx_user_subscriptions_status on public.user_subscriptions(status) where status = 'active';

-- 4. Credit ledger (audit trail, append-only)
create table if not exists public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  reason text not null,
  ref_type text,
  ref_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_ledger_user on public.ai_credit_ledger(user_id, created_at desc);

-- 5. Usage log (per AI call, for analytics + passport-style transparency)
create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null,
  credits_charged integer not null default 0,
  trip_id uuid references public.trips(id) on delete set null,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_user on public.ai_usage_log(user_id, created_at desc);
create index if not exists idx_ai_usage_endpoint on public.ai_usage_log(endpoint, created_at desc);

-- 6. Atomic consume function with monthly auto-reset
create or replace function public.consume_ai_credits(
  p_user_id uuid,
  p_cost int,
  p_endpoint text,
  p_trip_id uuid default null,
  p_model text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_quota int;
  v_period text;
  v_current text := to_char(now(), 'YYYY-MM');
  v_new_balance int;
begin
  if p_cost is null or p_cost <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Invalid cost');
  end if;

  select ai_credits_balance, ai_credits_quota, ai_credits_period
    into v_balance, v_quota, v_period
  from public.users
  where id = p_user_id
  for update;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'Profile not found');
  end if;

  -- Monthly reset when period rolled over
  if v_period is distinct from v_current then
    v_balance := coalesce(v_quota, 30);
    v_period := v_current;
    update public.users
    set ai_credits_balance = v_balance,
        ai_credits_period = v_period,
        updated_at = now()
    where id = p_user_id;
  end if;

  if v_balance < p_cost then
    return jsonb_build_object('ok', false, 'error', 'Insufficient credits', 'balance', v_balance, 'period', v_period);
  end if;

  v_new_balance := v_balance - p_cost;

  update public.users
  set ai_credits_balance = v_new_balance,
      updated_at = now()
  where id = p_user_id;

  insert into public.ai_credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id)
  values (p_user_id, -p_cost, v_new_balance, p_endpoint, 'trip', case when p_trip_id is null then null else p_trip_id::text end);

  insert into public.ai_usage_log (user_id, endpoint, credits_charged, trip_id, model)
  values (p_user_id, p_endpoint, p_cost, p_trip_id, p_model);

  return jsonb_build_object('ok', true, 'balance', v_new_balance, 'period', v_period);
end;
$$;

revoke execute on function public.consume_ai_credits(uuid, int, text, uuid, text) from public;
revoke execute on function public.consume_ai_credits(uuid, int, text, uuid, text) from anon;
revoke execute on function public.consume_ai_credits(uuid, int, text, uuid, text) from authenticated;
grant execute on function public.consume_ai_credits(uuid, int, text, uuid, text) to service_role;

-- 7. Grant / top-up helper (plan upgrade, monthly reset, admin adjustment, DOKU webhook)
create or replace function public.grant_ai_credits(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_set_quota int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_new_balance int;
  v_period text := to_char(now(), 'YYYY-MM');
begin
  if p_amount is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid amount');
  end if;

  select ai_credits_balance into v_balance from public.users where id = p_user_id for update;
  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'Profile not found');
  end if;

  v_new_balance := v_balance + p_amount;

  update public.users
  set ai_credits_balance = v_new_balance,
      ai_credits_quota = coalesce(p_set_quota, ai_credits_quota),
      ai_credits_period = v_period,
      updated_at = now()
  where id = p_user_id;

  insert into public.ai_credit_ledger (user_id, delta, balance_after, reason)
  values (p_user_id, p_amount, v_new_balance, p_reason);

  return jsonb_build_object('ok', true, 'balance', v_new_balance);
end;
$$;

revoke execute on function public.grant_ai_credits(uuid, int, text, int) from public;
revoke execute on function public.grant_ai_credits(uuid, int, text, int) from anon;
revoke execute on function public.grant_ai_credits(uuid, int, text, int) from authenticated;
grant execute on function public.grant_ai_credits(uuid, int, text, int) to service_role;
