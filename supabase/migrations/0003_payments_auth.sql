-- OTP auth (via Supabase Auth, email or phone) + orders for MyFatoorah payments.
-- auth.users is managed by Supabase; OTP verification populates rows there.
-- profiles holds app-specific user metadata. orders tracks payment + options.

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  phone        text,
  display_name text,
  created_at   timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_phone_idx on public.profiles (phone);

alter table public.profiles enable row level security;

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
  on public.profiles for select
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth.users row appears.
-- Copies whichever identifier (email or phone) the user signed up with.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone)
  values (new.id, new.email, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Orders: one row per purchase. Links to a story once generated.
create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  story_id              uuid references public.stories(id) on delete set null,
  amount_kwd            numeric(10, 3) not null check (amount_kwd >= 0),
  options               jsonb not null default '{}'::jsonb,
  -- options shape: { voice: bool, characterImage: bool, characterImagePath: string|null }
  status                text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'consumed')),
  myfatoorah_invoice_id text,
  myfatoorah_payment_id text,
  failure_reason        text,
  created_at            timestamptz not null default now(),
  paid_at               timestamptz,
  consumed_at           timestamptz
);

create index if not exists orders_user_id_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_invoice_idx on public.orders (myfatoorah_invoice_id);

alter table public.orders enable row level security;

drop policy if exists "orders_self_read" on public.orders;
create policy "orders_self_read"
  on public.orders for select
  using (auth.uid() = user_id);

-- All writes go through the API route with SUPABASE_SECRET_KEY which bypasses RLS.
-- No insert/update/delete policies = deny-by-default for the publishable key.
