create or replace function public.requesting_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with subject as (
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '') as sub
  )
  select coalesce(
    (
      select case
        when subject.sub ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then subject.sub::uuid
        else null
      end
      from subject
    ),
    (
      select u.id
      from public.users u
      join subject s on u.clerk_id = s.sub
      limit 1
    )
  );
$$;
