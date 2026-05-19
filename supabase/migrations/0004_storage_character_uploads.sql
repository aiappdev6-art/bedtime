-- Private bucket for user-uploaded character reference photos.
-- Server (service role) does the actual upload from the API route, so we don't
-- need authenticated-client upload policies. Reads also go through the server.
-- Policies below are defence in depth — they'd let an authenticated user upload
-- to / read from only their own {user_id}/ folder if we ever switch to direct
-- client uploads.

insert into storage.buckets (id, name, public)
values ('character-uploads', 'character-uploads', false)
on conflict (id) do nothing;

-- Allow authenticated users to manage files in their own folder.
-- Path convention: '{auth.uid()}/{anything}'
drop policy if exists "character_uploads_owner_read" on storage.objects;
create policy "character_uploads_owner_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'character-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "character_uploads_owner_insert" on storage.objects;
create policy "character_uploads_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'character-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "character_uploads_owner_delete" on storage.objects;
create policy "character_uploads_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'character-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
