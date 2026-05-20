-- Track whether voice narration was purchased for this story.
-- Needed so the viewer can show Play/Stop controls based on the purchase,
-- not on whether ElevenLabs happened to succeed. When voice = true but a
-- page's audioUrl is null (generation failed), the viewer falls back to
-- the browser SpeechSynthesis API.

alter table public.stories
  add column if not exists voice boolean not null default false;
