alter table public.users
add column if not exists email text;

alter table public.users
add column if not exists clerk_id text;

create unique index if not exists idx_users_clerk_id_unique
on public.users (clerk_id)
where clerk_id is not null;

create unique index if not exists idx_users_email_lower_unique
on public.users (lower(email))
where email is not null;
