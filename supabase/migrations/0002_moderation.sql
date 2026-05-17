-- Moderation columns: soft-delete + flagging for the admin dashboard.

alter table public.stories add column if not exists flagged_at      timestamptz;
alter table public.stories add column if not exists flagged_reason  text;
alter table public.stories add column if not exists deleted_at      timestamptz;

create index if not exists stories_active_idx
  on public.stories (created_at desc)
  where deleted_at is null;
