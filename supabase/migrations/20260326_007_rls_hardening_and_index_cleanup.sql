create or replace function public.requesting_user_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select case
    when (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
    else null
  end;
$$;

drop index if exists public.idx_itinerary_items_trip_id_v2;
drop index if exists public.idx_trips_user_id_v2;
drop index if exists public.idx_trips_status_v2;
drop index if exists public.idx_trips_public_id_v2;
drop index if exists public.idx_waha_log_created_at_v2;

create index if not exists idx_cs_queue_cs_id on public.cs_approval_queue(cs_id) where cs_id is not null;
create index if not exists idx_cs_queue_item_id on public.cs_approval_queue(item_id) where item_id is not null;
