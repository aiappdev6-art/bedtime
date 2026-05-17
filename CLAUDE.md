# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js app that turns a kid's story title + description into an animated 4-page illustrated storybook with narration. Stories are persisted in Supabase (scoped per-device), with a public `/library` for end users and a gated `/admin` dashboard for moderation.

## Stack

- Next.js 15 (App Router) + React 19, TypeScript, Tailwind CSS v4 (no config file — `@theme` in CSS)
- framer-motion for page transitions
- `@modelcontextprotocol/sdk` Streamable HTTP client for Lumen image MCP
- `@supabase/supabase-js` + `@supabase/ssr` for persistence and cookie-based auth
- ElevenLabs HTTP API for narration (optional — falls back to browser TTS)

## Big picture

Three layers stacked on the same Next.js app:

### 1. Generation pipeline (`/api/generate`)
`app/api/generate/route.ts` orchestrates everything for a single story request. It runs on the **Node runtime** (the MCP SDK requires it) with `maxDuration = 300`. Flow:

1. `lib/openrouter.ts` → one chat completion that returns `{ title, characterSheet, pages: [{ text, imagePrompt }] }` (always exactly 4 pages — validated after the LLM returns).
2. **In parallel for each page:** `lib/images.ts` generates an illustration *and* `lib/elevenlabs.ts` synthesises narration. Image generation cascades through providers — preferred (env-selected) → others → picsum placeholder — never throws. Errors are logged with `[image:<provider>]` and `[elevenlabs]` prefixes.
3. If a `deviceId` is on the request, insert a row into `public.stories` via the admin client (`lib/supabase/server.ts`, bypasses RLS) and return `{ id, story }`. Without a `deviceId` the route still returns the story (legacy sessionStorage path).

### 2. Persistence & per-device library
- Device identity is a UUID in `localStorage` (`lib/deviceId.ts`, key `story-device-id`). No accounts on the public side.
- Schema is in `supabase/migrations/*.sql`. The `stories` table has RLS **enabled with no policies** — deny-by-default. All public reads/writes go through Next.js API routes using `SUPABASE_SECRET_KEY` (the server client), so RLS protects the table even when the publishable key leaks.
- `app/page.tsx` → `/api/generate` → navigates to `/story/[id]`. The `[id]` route server-renders by fetching the row directly. The old `/story` route still works for the sessionStorage handoff (kept as fallback).
- `app/library/page.tsx` calls `/api/library?deviceId=...` to list non-deleted stories for that device.
- Public reads filter `deleted_at IS NULL`. `/story/[id]` returns 404 for soft-deleted rows.

### 3. Admin dashboard
- Routes under `/admin/*` are gated by `middleware.ts`: it checks the Supabase session cookie and rejects anyone whose email ≠ `ADMIN_EMAIL`. The same check is repeated in `app/admin/layout.tsx` (defence in depth) and in `/api/admin/stories/[id]` before any mutation.
- Auth is Supabase Auth email/password. Cookie session is set by `@supabase/ssr`'s `createBrowserClient` (browser) and read by `createServerClient` (middleware, server components, API routes — see `lib/supabase/ssr.ts`).
- Moderation actions (`flag`, `unflag`, `delete`, `restore`) are soft — they set/clear `flagged_at`, `flagged_reason`, `deleted_at`. Nothing is hard-deleted from `stories`.
- Admin user is provisioned manually via the Supabase Admin API; the `ADMIN_EMAIL` env var must match exactly.

## Two Supabase clients — don't mix them up

| File | Key | Use for |
|---|---|---|
| `lib/supabase/server.ts` (`supabaseAdmin`) | `SUPABASE_SECRET_KEY` | Server-only writes/reads that need to bypass RLS (API routes, server components). **Never import in a client component.** |
| `lib/supabase/ssr.ts` (`createSupabaseServerClient`) | publishable, with cookies | Reading the *current user's session* in server components / route handlers (admin gate). |
| `lib/supabase/browser.ts` (`supabaseBrowser`) | publishable, browser cookies | Client components that need to sign in/out. |

If you're tempted to use `supabaseBrowser` to read `stories` directly from the client — don't. RLS will return nothing. Add an API route.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build — run this to verify before pushing
npm run lint       # next lint
```

Vercel auto-deploys from `main`. There is no test suite.

## Env vars

Required vars are in `.env.example`. Restart `next dev` after changes — Next.js only reads `.env.local` at boot.

| Var | Required | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | yes | Story text generation |
| `OPENROUTER_MODEL` | no | Defaults to `openai/gpt-4o-mini` |
| `IMAGE_PROVIDER` | no | `pollinations` (default, free), `openrouter` (paid), `lumen` |
| `POLLINATIONS_MODEL` / `POLLINATIONS_TOKEN` | no | Only set `MODEL` if you have a `TOKEN` |
| `OPENROUTER_IMAGE_MODEL` | no | Defaults to `google/gemini-2.5-flash-image-preview` |
| `LUMEN_TOKEN` / `LUMEN_MCP_URL` | only for lumen | Lumen MCP credentials |
| `ELEVENLABS_API_KEY` / `_VOICE_ID` / `_MODEL_ID` | no | Leave blank to disable audio (viewer falls back to browser TTS) |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Public — also used by middleware |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Public — replaces legacy `anon` |
| `SUPABASE_SECRET_KEY` | yes | Server-only — replaces legacy `service_role`. Bypasses RLS. On Vercel must be type `sensitive`, and `sensitive` vars **cannot target `development`** (production + preview only). |
| `ADMIN_EMAIL` | yes (for `/admin`) | Only this email passes the admin gate |

## Conventions & gotchas

- **Story is always 4 pages.** Enforced in `lib/openrouter.ts` after the LLM returns. If changing, update the system prompt *and* the validation check.
- **Image generation never throws.** Provider failures cascade silently; the last fallback is picsum. Don't add a top-level try/catch around `generateImage` thinking it's missing — that's intentional.
- **Image URLs are base64 data URIs** (server-fetched and inlined). Don't change this to a remote URL unless you also add per-page loading states.
- **Run migrations manually.** SQL files in `supabase/migrations/` are reference only — no migration runner. Paste them into the Supabase SQL editor.
- **`/story` (no id) reads sessionStorage and redirects to `/` on miss.** That's the legacy handoff path; `/story/[id]` is the persistent one. A refresh on `/story/[id]` works because it server-renders from Supabase.
- **`.mcp.json` uses `${LUMEN_TOKEN}` env expansion.** Never hardcode the token there.
- **Tailwind v4** — no `tailwind.config.ts`. Config goes in CSS via `@theme`. Don't recreate the v3 config.
- **Middleware matcher is `/admin/:path*`** — `/admin/login` is included, but the middleware lets unauthenticated users through to that one path so they can sign in.
