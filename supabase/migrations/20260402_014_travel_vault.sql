-- Migration 014: Travel Vault — bookings, actual costs, photo linkage
-- Supports: Ticket/Booking Parser, Ticket Locker, Actual vs Estimated expenses,
-- Memory scrapbook photo-to-itinerary linking, Today Mode, Wrapped, Passport.

-- 1. Booking type enum
do $$
begin
  create type public.booking_type as enum ('flight', 'train', 'hotel', 'ferry', 'bus', 'activity', 'other');
exception
  when duplicate_object then null;
end $$;

-- 2. Trip bookings / ticket locker
create table if not exists public.trip_bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  booking_type public.booking_type not null default 'other',
  provider text,
  booking_ref text,
  title text not null,
  origin text,
  destination text,
  depart_at timestamptz,
  arrive_at timestamptz,
  check_in date,
  check_out date,
  details jsonb not null default '{}'::jsonb,
  file_url text,
  linked_item_id uuid references public.itinerary_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trip_bookings_trip_id on public.trip_bookings(trip_id);
create index if not exists idx_trip_bookings_user_id on public.trip_bookings(user_id);
create index if not exists idx_trip_bookings_linked_item on public.trip_bookings(linked_item_id) where linked_item_id is not null;

-- updated_at trigger (reuse set_updated_at if exists)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    if not exists (select 1 from pg_trigger where tgname = 'set_trip_bookings_updated_at') then
      create trigger set_trip_bookings_updated_at
        before update on public.trip_bookings
        for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;

-- 3. Actual vs estimated costs on itinerary items
alter table public.itinerary_items
  add column if not exists actual_cost_idr integer check (actual_cost_idr is null or actual_cost_idr >= 0);

-- 4. Photo-to-itinerary linkage for scrapbook / EXIF auto-sort
alter table public.trip_photos
  add column if not exists itinerary_item_id uuid references public.itinerary_items(id) on delete set null,
  add column if not exists taken_at timestamptz,
  add column if not exists day_number integer check (day_number is null or day_number >= 1);

create index if not exists idx_trip_photos_trip_item on public.trip_photos(trip_id, itinerary_item_id) where itinerary_item_id is not null;
create index if not exists idx_trip_photos_taken_at on public.trip_photos(trip_id, taken_at) where taken_at is not null;
