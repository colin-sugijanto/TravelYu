create or replace function public.requesting_user_id()
returns uuid
language sql
stable
as $$
  select case
    when (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
    else null
  end;
$$;

alter policy users_select on public.users
using (id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()));

alter policy users_insert on public.users
with check (id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()));

alter policy users_update on public.users
using (id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
with check (id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()));

alter policy user_points_select on public.user_points
using (user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()));

alter policy user_points_update_admin on public.user_points
using (public.is_admin(public.requesting_user_id()))
with check (public.is_admin(public.requesting_user_id()));

alter policy trips_select on public.trips
using (
  public.is_trip_participant(id, public.requesting_user_id())
  or public.is_admin(public.requesting_user_id())
);

alter policy trips_insert on public.trips
with check (user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()));

alter policy trips_update on public.trips
using (user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
with check (user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()));

alter policy vendors_write_super_admin on public.vendors
using (public.is_super_admin(public.requesting_user_id()))
with check (public.is_super_admin(public.requesting_user_id()));

alter policy itinerary_select on public.itinerary_items
using (
  public.is_trip_participant(trip_id, public.requesting_user_id())
  or public.is_admin(public.requesting_user_id())
);

alter policy itinerary_write on public.itinerary_items
using (
  exists (
    select 1
    from public.trips t
    where t.id = itinerary_items.trip_id
      and (t.user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
  )
)
with check (
  exists (
    select 1
    from public.trips t
    where t.id = itinerary_items.trip_id
      and (t.user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
  )
);

alter policy group_members_select on public.group_trip_members
using (
  user_id = public.requesting_user_id()
  or exists (
    select 1 from public.trips t
    where t.id = group_trip_members.trip_id
      and t.user_id = public.requesting_user_id()
  )
  or public.is_admin(public.requesting_user_id())
);

alter policy group_members_write on public.group_trip_members
using (
  exists (
    select 1 from public.trips t
    where t.id = group_trip_members.trip_id
      and (t.user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
  )
)
with check (
  exists (
    select 1 from public.trips t
    where t.id = group_trip_members.trip_id
      and (t.user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
  )
);

alter policy cs_queue_select_admin on public.cs_approval_queue
using (public.is_admin(public.requesting_user_id()));

alter policy cs_queue_insert_owner_or_admin on public.cs_approval_queue
with check (
  public.is_admin(public.requesting_user_id())
  or exists (
    select 1 from public.trips t
    where t.id = cs_approval_queue.trip_id
      and t.user_id = public.requesting_user_id()
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

alter policy cs_queue_update_admin on public.cs_approval_queue
using (public.is_admin(public.requesting_user_id()))
with check (public.is_admin(public.requesting_user_id()));

alter policy cs_chat_select on public.cs_chat_sessions
using (
  user_id = public.requesting_user_id()
  or cs_id = public.requesting_user_id()
  or public.is_admin(public.requesting_user_id())
);

alter policy cs_chat_insert on public.cs_chat_sessions
with check (
  (user_id = public.requesting_user_id() and public.is_trip_participant(trip_id, public.requesting_user_id()))
  or public.is_admin(public.requesting_user_id())
);

alter policy cs_chat_update on public.cs_chat_sessions
using (
  cs_id = public.requesting_user_id()
  or public.is_admin(public.requesting_user_id())
)
with check (
  cs_id = public.requesting_user_id()
  or public.is_admin(public.requesting_user_id())
);

alter policy vendor_reviews_select on public.vendor_reviews
using (is_public or user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()));

alter policy vendor_reviews_insert on public.vendor_reviews
with check (
  user_id = public.requesting_user_id()
  and exists (
    select 1 from public.trips t
    where t.id = vendor_reviews.trip_id
      and t.user_id = public.requesting_user_id()
      and t.status = 'completed'
  )
);

alter policy vendor_reviews_update on public.vendor_reviews
using (user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
with check (user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()));

alter policy trip_photos_select on public.trip_photos
using (
  public.is_trip_participant(trip_id, public.requesting_user_id())
  or public.is_admin(public.requesting_user_id())
);

alter policy trip_photos_insert on public.trip_photos
with check (
  user_id = public.requesting_user_id()
  and public.is_trip_participant(trip_id, public.requesting_user_id())
);

alter policy trip_photos_update_delete on public.trip_photos
using (user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
with check (user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()));

alter policy points_log_select on public.user_points_log
using (user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()));

alter policy points_log_insert_admin on public.user_points_log
with check (public.is_admin(public.requesting_user_id()));

alter policy waha_log_admin_only on public.waha_message_log
using (public.is_admin(public.requesting_user_id()))
with check (public.is_admin(public.requesting_user_id()));

alter policy comparison_select on public.comparison_options
using (
  public.is_trip_participant(trip_id, public.requesting_user_id())
  or public.is_admin(public.requesting_user_id())
);

alter policy comparison_write on public.comparison_options
using (
  exists (
    select 1 from public.trips t
    where t.id = comparison_options.trip_id
      and (t.user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
  )
)
with check (
  exists (
    select 1 from public.trips t
    where t.id = comparison_options.trip_id
      and (t.user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
  )
);

alter policy trip_preferences_select on public.trip_preferences
using (
  public.is_trip_participant(trip_id, public.requesting_user_id())
  or public.is_admin(public.requesting_user_id())
);

alter policy trip_preferences_write on public.trip_preferences
using (
  exists (
    select 1 from public.trips t
    where t.id = trip_preferences.trip_id
      and (t.user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
  )
)
with check (
  exists (
    select 1 from public.trips t
    where t.id = trip_preferences.trip_id
      and (t.user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
  )
);

alter policy trip_feedback_select on public.trip_item_feedback
using (
  public.is_trip_participant(trip_id, public.requesting_user_id())
  or public.is_admin(public.requesting_user_id())
);

alter policy trip_feedback_insert on public.trip_item_feedback
with check (
  user_id = public.requesting_user_id()
  and public.is_trip_participant(trip_id, public.requesting_user_id())
  and exists (
    select 1
    from public.itinerary_items i
    where i.id = trip_item_feedback.itinerary_item_id
      and i.trip_id = trip_item_feedback.trip_id
  )
);

alter policy trip_feedback_update_delete on public.trip_item_feedback
using (user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()))
with check (user_id = public.requesting_user_id() or public.is_admin(public.requesting_user_id()));
