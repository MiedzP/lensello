-- Custom authentication users table
-- Replaces Supabase Auth with JWT-based system

create table public.users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  password_hash   text not null,
  full_name       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.users is 'Custom JWT-based authentication users';

-- Link users to profiles (one-to-one)
alter table public.profiles
  add column user_id uuid unique references public.users(id) on delete cascade;

-- Enable RLS on users table
alter table public.users enable row level security;

-- Users can read their own row only
create policy users_select_self on public.users
  for select to authenticated
  using (id = auth.uid());

-- Staff can read all users (for admin/staff pages)
create policy users_select_staff on public.users
  for select to authenticated
  using (public.is_staff());

-- Index on email for fast login lookups
create index idx_users_email on public.users(email);
