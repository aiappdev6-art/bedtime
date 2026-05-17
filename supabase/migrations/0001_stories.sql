-- Stories table: one row per generated storybook.
-- v1 is anon-only, scoped by a client-generated device_id stored in localStorage.
-- user_id is reserved for when Supabase Auth is added.

create extension if not exists "pgcrypto";

create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  device_id   text not null,
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  pages       jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists stories_device_id_idx on public.stories (device_id, created_at desc);
create index if not exists stories_user_id_idx on public.stories (user_id, created_at desc);

alter table public.stories enable row level security;

-- RLS: anon/publishable key cannot read or write directly.
-- All writes go through the Next.js API route using the secret key,
-- which bypasses RLS. Reads from the browser also go through the API
-- to filter by device_id server-side. (When auth is added, we'll relax
-- this and let authenticated users read their own rows directly.)
--
-- No policies are created here on purpose — deny-by-default is correct.
