-- Migration 017: Vault Phase 2 — ticket storage, expense split, seamless journey
-- - public bucket `trip-tickets` for e-ticket PDFs/images (all files go to Supabase Storage)
-- - `trip_expenses` for group expense split / settle-up
-- - storage public-read policies (service_role bypasses RLS; anon needs read for public URLs)

-- 1. Buckets (idempotent)
insert into storage.buckets (id, name, public)
values ('trip-tickets', 'trip-tickets', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', true)
on conflict (id) do update set public = true;

-- 2. Public read policies on storage.objects (idempotent via DO blocks)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read trip-tickets') then
    create policy "Public read trip-tickets"
      on storage.objects for select
      using (bucket_id = 'trip-tickets');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read trip-photos') then
    create policy "Public read trip-photos"
      on storage.objects for select
      using (bucket_id = 'trip-photos');
  end if;
end $$;

-- 3. Group expense split
create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  amount_idr integer not null check (amount_idr >= 0),
  paid_by text not null default 'Saya',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_expenses_trip_id on public.trip_expenses(trip_id);
create index if not exists idx_trip_expenses_user_id on public.trip_expenses(user_id);

alter table public.trip_expenses enable row level security;
