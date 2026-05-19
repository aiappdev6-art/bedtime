-- Private bucket for cached PDF exports. Path convention: '{story_id}.pdf'.
-- All access goes through /api/story/[id]/pdf which uses the service role,
-- so we don't need authenticated-client policies on this bucket.

insert into storage.buckets (id, name, public)
values ('stories-pdf', 'stories-pdf', false)
on conflict (id) do nothing;
