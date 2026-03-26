alter table public.users
drop constraint if exists users_id_fkey;

alter table public.users
alter column id set default gen_random_uuid();
