create extension if not exists pg_trgm;

create index if not exists idx_trips_user_id_v2 on public.trips(user_id);
create index if not exists idx_trips_status_v2 on public.trips(status);
create index if not exists idx_trips_public_id_v2 on public.trips(public_id);

create index if not exists idx_itinerary_items_trip_id_v2 on public.itinerary_items(trip_id);
create index if not exists idx_itinerary_items_trip_day_sort_v2 on public.itinerary_items(trip_id, day_number, sort_order);
create index if not exists idx_itinerary_items_vendor_id_v2 on public.itinerary_items(vendor_id) where vendor_id is not null;

create index if not exists idx_cs_queue_status_v2 on public.cs_approval_queue(status);
create index if not exists idx_cs_queue_trip_id_v2 on public.cs_approval_queue(trip_id);

create index if not exists idx_vendors_city_v2 on public.vendors(city);
create index if not exists idx_vendors_name_trgm_v2 on public.vendors using gin(name gin_trgm_ops);

create index if not exists idx_waha_log_created_at_v2 on public.waha_message_log(created_at desc);
create index if not exists idx_points_log_user_id_v2 on public.user_points_log(user_id);
