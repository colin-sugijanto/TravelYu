create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('user', 'admin', 'super_admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.loyalty_tier as enum ('explorer', 'adventurer', 'wanderer');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.trip_status as enum (
    'intake',
    'payment_pending',
    'paid',
    'generating',
    'draft',
    'approved',
    'active',
    'completed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.time_slot as enum ('morning', 'afternoon', 'evening', 'night');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.activity_type as enum ('accommodation', 'transport', 'dining', 'attraction', 'experience', 'rest');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.itinerary_item_status as enum ('draft', 'booked_flexible', 'booked_locked', 'cancelled', 'flagged');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.vendor_type as enum ('hotel', 'villa', 'restaurant', 'attraction', 'transport', 'experience', 'guide');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.price_tier as enum ('budget', 'mid', 'premium');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.group_member_role as enum ('owner', 'member');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.cs_approval_status as enum ('pending', 'approved', 'rejected', 'edited_manual');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.chat_session_status as enum ('open', 'resolved');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.recipient_type as enum ('user', 'vendor');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.message_status as enum ('queued', 'sent', 'delivered', 'failed', 'received');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  whatsapp_number text,
  travel_preferences jsonb not null default '{}'::jsonb,
  role public.user_role not null default 'user',
  points_balance integer not null default 0,
  lifetime_points integer not null default 0,
  loyalty_tier public.loyalty_tier not null default 'explorer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_points (
  user_id uuid primary key references public.users(id) on delete cascade,
  points_balance integer not null default 0,
  lifetime_points integer not null default 0,
  tier public.loyalty_tier not null default 'explorer',
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  public_id text not null unique default substring(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  status public.trip_status not null default 'intake',
  payment_status public.payment_status not null default 'pending',
  payment_ref text,
  planning_fee_idr integer not null default 99000,
  is_group_trip boolean not null default false,
  is_surprise_mode boolean not null default false,
  intake_data jsonb not null default '{}'::jsonb,
  selected_comparison_option integer,
  total_est_cost_idr integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_selected_option_chk check (selected_comparison_option is null or selected_comparison_option between 1 and 3)
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.vendor_type not null,
  city text not null,
  province text not null,
  whatsapp_number text,
  api_endpoint text,
  price_tier public.price_tier not null default 'mid',
  avg_rating numeric(3,2),
  is_verified boolean not null default false,
  location_lat numeric(10,7),
  location_lng numeric(10,7),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number integer not null check (day_number >= 1),
  time_slot public.time_slot not null,
  sort_order integer not null default 1,
  activity_type public.activity_type not null,
  vendor_id uuid references public.vendors(id) on delete set null,
  title text not null,
  description text not null,
  tips text,
  est_cost_idr integer not null default 0,
  location_lat numeric(10,7),
  location_lng numeric(10,7),
  location_address text,
  status public.itinerary_item_status not null default 'draft',
  source text not null default 'internal_db' check (source in ('internal_db', 'web_search', 'provider_api', 'manual_cs')),
  booking_url text,
  booking_ref text,
  flagged_reason text,
  flagged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.group_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.cs_approval_queue (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  item_id uuid references public.itinerary_items(id) on delete set null,
  requested_change jsonb not null default '{}'::jsonb,
  status public.cs_approval_status not null default 'pending',
  cs_id uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cs_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  cs_id uuid references public.users(id) on delete set null,
  status public.chat_session_status not null default 'open',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_reviews (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  is_public boolean not null default true,
  is_flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(vendor_id, user_id, trip_id)
);

create table if not exists public.trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  storage_path text not null,
  caption text,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.user_points_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  points_delta integer not null,
  event_type text not null,
  reference_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.waha_message_log (
  id uuid primary key default gen_random_uuid(),
  recipient_type public.recipient_type not null,
  recipient_id text not null,
  message text not null,
  status public.message_status not null default 'queued',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.comparison_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  option_number integer not null check (option_number between 1 and 3),
  summary jsonb not null,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, option_number)
);

create table if not exists public.trip_preferences (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  selected_option_number integer not null check (selected_option_number between 1 and 3),
  selected_at timestamptz not null default now(),
  notes text
);

create table if not exists public.trip_item_feedback (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  itinerary_item_id uuid not null references public.itinerary_items(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  comment text,
  upvote boolean not null default false,
  created_at timestamptz not null default now(),
  unique (itinerary_item_id, user_id)
);

create index if not exists idx_trips_user_id on public.trips(user_id);
create index if not exists idx_trips_status on public.trips(status);
create index if not exists idx_trips_payment_status on public.trips(payment_status);
create index if not exists idx_trips_public_id on public.trips(public_id);

create index if not exists idx_itinerary_items_trip_id on public.itinerary_items(trip_id);
create index if not exists idx_itinerary_items_trip_day on public.itinerary_items(trip_id, day_number, time_slot, sort_order);
create index if not exists idx_itinerary_items_status on public.itinerary_items(status);

create index if not exists idx_group_trip_members_user on public.group_trip_members(user_id);
create index if not exists idx_cs_approval_queue_trip on public.cs_approval_queue(trip_id, status);
create index if not exists idx_cs_chat_sessions_trip on public.cs_chat_sessions(trip_id, status);
create index if not exists idx_vendor_reviews_vendor on public.vendor_reviews(vendor_id, is_public);
create index if not exists idx_trip_photos_trip on public.trip_photos(trip_id, uploaded_at desc);
create index if not exists idx_user_points_log_user on public.user_points_log(user_id, created_at desc);
create index if not exists idx_waha_message_log_created on public.waha_message_log(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = uid
      and u.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = uid
      and u.role = 'super_admin'
  );
$$;

create or replace function public.is_trip_participant(trip_uuid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = trip_uuid
      and t.user_id = uid
  )
  or exists (
    select 1
    from public.group_trip_members g
    where g.trip_id = trip_uuid
      and g.user_id = uid
  );
$$;

create or replace function public.refresh_loyalty_tier(p_points integer)
returns public.loyalty_tier
language plpgsql
immutable
as $$
begin
  if p_points >= 2000 then
    return 'wanderer';
  elsif p_points >= 500 then
    return 'adventurer';
  else
    return 'explorer';
  end if;
end;
$$;

create or replace function public.apply_points_event(
  p_user_id uuid,
  p_points_delta integer,
  p_event_type text,
  p_reference_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
  v_lifetime integer;
  v_tier public.loyalty_tier;
begin
  insert into public.user_points_log (user_id, points_delta, event_type, reference_id)
  values (p_user_id, p_points_delta, p_event_type, p_reference_id);

  insert into public.user_points (user_id, points_balance, lifetime_points, tier)
  values (p_user_id, greatest(0, p_points_delta), greatest(0, p_points_delta), public.refresh_loyalty_tier(greatest(0, p_points_delta)))
  on conflict (user_id)
  do update set
    points_balance = greatest(0, public.user_points.points_balance + excluded.points_balance),
    lifetime_points = greatest(public.user_points.lifetime_points, public.user_points.lifetime_points + greatest(0, p_points_delta)),
    updated_at = now();

  select points_balance, lifetime_points
    into v_points, v_lifetime
  from public.user_points
  where user_id = p_user_id;

  v_tier := public.refresh_loyalty_tier(v_points);

  update public.user_points
  set tier = v_tier,
      updated_at = now()
  where user_id = p_user_id;

  update public.users
  set points_balance = v_points,
      lifetime_points = v_lifetime,
      loyalty_tier = v_tier,
      updated_at = now()
  where id = p_user_id;
end;
$$;

revoke execute on function public.apply_points_event(uuid, integer, text, text) from public;
revoke execute on function public.apply_points_event(uuid, integer, text, text) from anon;
revoke execute on function public.apply_points_event(uuid, integer, text, text) from authenticated;
grant execute on function public.apply_points_event(uuid, integer, text, text) to service_role;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;

  insert into public.user_points (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.enforce_trip_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.trip_photos where trip_id = new.trip_id;
  if v_count >= 20 then
    raise exception 'Maximum 20 photos per trip in MVP';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_trips_updated_at on public.trips;
create trigger trg_trips_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

drop trigger if exists trg_vendors_updated_at on public.vendors;
create trigger trg_vendors_updated_at
before update on public.vendors
for each row execute function public.set_updated_at();

drop trigger if exists trg_itinerary_items_updated_at on public.itinerary_items;
create trigger trg_itinerary_items_updated_at
before update on public.itinerary_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_cs_approval_queue_updated_at on public.cs_approval_queue;
create trigger trg_cs_approval_queue_updated_at
before update on public.cs_approval_queue
for each row execute function public.set_updated_at();

drop trigger if exists trg_cs_chat_sessions_updated_at on public.cs_chat_sessions;
create trigger trg_cs_chat_sessions_updated_at
before update on public.cs_chat_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_vendor_reviews_updated_at on public.vendor_reviews;
create trigger trg_vendor_reviews_updated_at
before update on public.vendor_reviews
for each row execute function public.set_updated_at();

drop trigger if exists trg_comparison_options_updated_at on public.comparison_options;
create trigger trg_comparison_options_updated_at
before update on public.comparison_options
for each row execute function public.set_updated_at();

drop trigger if exists trg_trip_photos_limit on public.trip_photos;
create trigger trg_trip_photos_limit
before insert on public.trip_photos
for each row execute function public.enforce_trip_photo_limit();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.users enable row level security;
alter table public.user_points enable row level security;
alter table public.trips enable row level security;
alter table public.vendors enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.group_trip_members enable row level security;
alter table public.cs_approval_queue enable row level security;
alter table public.cs_chat_sessions enable row level security;
alter table public.vendor_reviews enable row level security;
alter table public.trip_photos enable row level security;
alter table public.user_points_log enable row level security;
alter table public.waha_message_log enable row level security;
alter table public.comparison_options enable row level security;
alter table public.trip_preferences enable row level security;
alter table public.trip_item_feedback enable row level security;

drop policy if exists users_select on public.users;
create policy users_select on public.users
for select
using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists users_insert on public.users;
create policy users_insert on public.users
for insert
with check (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists users_update on public.users;
create policy users_update on public.users
for update
using (id = auth.uid() or public.is_admin(auth.uid()))
with check (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists user_points_select on public.user_points;
create policy user_points_select on public.user_points
for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists user_points_update_admin on public.user_points;
create policy user_points_update_admin on public.user_points
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
for select
using (
  public.is_trip_participant(id, auth.uid())
  or public.is_admin(auth.uid())
);

drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips
for insert
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips
for update
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists vendors_select_public on public.vendors;
create policy vendors_select_public on public.vendors
for select
using (true);

drop policy if exists vendors_write_super_admin on public.vendors;
create policy vendors_write_super_admin on public.vendors
for all
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

drop policy if exists itinerary_select on public.itinerary_items;
create policy itinerary_select on public.itinerary_items
for select
using (
  public.is_trip_participant(trip_id, auth.uid())
  or public.is_admin(auth.uid())
);

drop policy if exists itinerary_write on public.itinerary_items;
create policy itinerary_write on public.itinerary_items
for all
using (
  exists (
    select 1
    from public.trips t
    where t.id = itinerary_items.trip_id
      and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
)
with check (
  exists (
    select 1
    from public.trips t
    where t.id = itinerary_items.trip_id
      and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

drop policy if exists group_members_select on public.group_trip_members;
create policy group_members_select on public.group_trip_members
for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.trips t
    where t.id = group_trip_members.trip_id
      and t.user_id = auth.uid()
  )
  or public.is_admin(auth.uid())
);

drop policy if exists group_members_write on public.group_trip_members;
create policy group_members_write on public.group_trip_members
for all
using (
  exists (
    select 1 from public.trips t
    where t.id = group_trip_members.trip_id
      and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.trips t
    where t.id = group_trip_members.trip_id
      and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

drop policy if exists cs_queue_select_admin on public.cs_approval_queue;
create policy cs_queue_select_admin on public.cs_approval_queue
for select
using (public.is_admin(auth.uid()));

drop policy if exists cs_queue_insert_owner_or_admin on public.cs_approval_queue;
create policy cs_queue_insert_owner_or_admin on public.cs_approval_queue
for insert
with check (
  public.is_admin(auth.uid())
  or exists (
    select 1 from public.trips t
    where t.id = cs_approval_queue.trip_id
      and t.user_id = auth.uid()
  )
  and (
    item_id is null
    or exists (
      select 1
      from public.itinerary_items i
      where i.id = cs_approval_queue.item_id
        and i.trip_id = cs_approval_queue.trip_id
    )
  )
);

drop policy if exists cs_queue_update_admin on public.cs_approval_queue;
create policy cs_queue_update_admin on public.cs_approval_queue
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists cs_chat_select on public.cs_chat_sessions;
create policy cs_chat_select on public.cs_chat_sessions
for select
using (
  user_id = auth.uid()
  or cs_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists cs_chat_insert on public.cs_chat_sessions;
create policy cs_chat_insert on public.cs_chat_sessions
for insert
with check (
  (user_id = auth.uid() and public.is_trip_participant(trip_id, auth.uid()))
  or public.is_admin(auth.uid())
);

drop policy if exists cs_chat_update on public.cs_chat_sessions;
create policy cs_chat_update on public.cs_chat_sessions
for update
using (
  cs_id = auth.uid()
  or public.is_admin(auth.uid())
)
with check (
  cs_id = auth.uid()
  or public.is_admin(auth.uid())
);

drop policy if exists vendor_reviews_select on public.vendor_reviews;
create policy vendor_reviews_select on public.vendor_reviews
for select
using (is_public or user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists vendor_reviews_insert on public.vendor_reviews;
create policy vendor_reviews_insert on public.vendor_reviews
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.trips t
    where t.id = vendor_reviews.trip_id
      and t.user_id = auth.uid()
      and t.status = 'completed'
  )
);

drop policy if exists vendor_reviews_update on public.vendor_reviews;
create policy vendor_reviews_update on public.vendor_reviews
for update
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists trip_photos_select on public.trip_photos;
create policy trip_photos_select on public.trip_photos
for select
using (
  public.is_trip_participant(trip_id, auth.uid())
  or public.is_admin(auth.uid())
);

drop policy if exists trip_photos_insert on public.trip_photos;
create policy trip_photos_insert on public.trip_photos
for insert
with check (
  user_id = auth.uid()
  and public.is_trip_participant(trip_id, auth.uid())
);

drop policy if exists trip_photos_update_delete on public.trip_photos;
create policy trip_photos_update_delete on public.trip_photos
for all
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists points_log_select on public.user_points_log;
create policy points_log_select on public.user_points_log
for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists points_log_insert_admin on public.user_points_log;
create policy points_log_insert_admin on public.user_points_log
for insert
with check (public.is_admin(auth.uid()));

drop policy if exists waha_log_admin_only on public.waha_message_log;
create policy waha_log_admin_only on public.waha_message_log
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists comparison_select on public.comparison_options;
create policy comparison_select on public.comparison_options
for select
using (
  public.is_trip_participant(trip_id, auth.uid())
  or public.is_admin(auth.uid())
);

drop policy if exists comparison_write on public.comparison_options;
create policy comparison_write on public.comparison_options
for all
using (
  exists (
    select 1 from public.trips t
    where t.id = comparison_options.trip_id
      and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.trips t
    where t.id = comparison_options.trip_id
      and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

drop policy if exists trip_preferences_select on public.trip_preferences;
create policy trip_preferences_select on public.trip_preferences
for select
using (
  public.is_trip_participant(trip_id, auth.uid())
  or public.is_admin(auth.uid())
);

drop policy if exists trip_preferences_write on public.trip_preferences;
create policy trip_preferences_write on public.trip_preferences
for all
using (
  exists (
    select 1 from public.trips t
    where t.id = trip_preferences.trip_id
      and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.trips t
    where t.id = trip_preferences.trip_id
      and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

drop policy if exists trip_feedback_select on public.trip_item_feedback;
create policy trip_feedback_select on public.trip_item_feedback
for select
using (
  public.is_trip_participant(trip_id, auth.uid())
  or public.is_admin(auth.uid())
);

drop policy if exists trip_feedback_insert on public.trip_item_feedback;
create policy trip_feedback_insert on public.trip_item_feedback
for insert
with check (
  user_id = auth.uid()
  and public.is_trip_participant(trip_id, auth.uid())
  and exists (
    select 1
    from public.itinerary_items i
    where i.id = trip_item_feedback.itinerary_item_id
      and i.trip_id = trip_item_feedback.trip_id
  )
);

drop policy if exists trip_feedback_update_delete on public.trip_item_feedback;
create policy trip_feedback_update_delete on public.trip_item_feedback
for all
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));
