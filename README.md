# Bedtime — Kid's Story Maker

Generate illustrated 4-page kid's stories from a title and description. Built with Next.js 15, Tailwind v4, and framer-motion. Uses an LLM (via OpenRouter) to write the story, a configurable image provider (Pollinations / OpenRouter / Lumen MCP) to illustrate it, ElevenLabs for narration, and Supabase to persist stories so they can be revisited from a per-device library.

## How it works

1. Enter a title and a short description.
2. The server calls OpenRouter to write a 4-page story as JSON (`text` + `imagePrompt` per page) along with a character sheet for consistency.
3. In parallel for each page: an illustration is generated from the chosen image provider, and ElevenLabs synthesises narration audio.
4. The story is saved to Supabase (`stories` table, scoped by a `device_id` stored in `localStorage`).
5. The browser navigates to `/story/{id}`, which server-renders the saved story.
6. A framer-motion viewer flips through the pages with play/stop narration controls.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript, Tailwind CSS v4
- framer-motion (page transitions)
- `@modelcontextprotocol/sdk` (Lumen MCP client)
- `@supabase/supabase-js` (story persistence)
- ElevenLabs (text-to-speech narration, optional)

## Setup

```bash
npm install
cp .env.example .env.local
# fill in OPENROUTER_API_KEY and the three NEXT_PUBLIC_SUPABASE_* / SUPABASE_SECRET_KEY values
npm run dev
```

Open http://localhost:3000.

### Supabase migration

Once your Supabase project exists, apply the schema by pasting [`supabase/migrations/0001_stories.sql`](supabase/migrations/0001_stories.sql) into the Supabase SQL editor and clicking Run. RLS is enabled with no policies — all access flows through the server using the secret key.

## Environment variables

| Var | Required | Default | Notes |
|---|---|---|---|
| `OPENROUTER_API_KEY` | yes | — | Story text generation |
| `OPENROUTER_MODEL` | no | `openai/gpt-4o-mini` | Any OpenRouter chat model |
| `IMAGE_PROVIDER` | no | `pollinations` | `pollinations` (free), `openrouter` (paid), `lumen` |
| `POLLINATIONS_MODEL` | no | _(anonymous)_ | Set `flux`/`turbo` only with a `POLLINATIONS_TOKEN` |
| `POLLINATIONS_TOKEN` | no | — | Removes watermark |
| `POLLINATIONS_WIDTH` / `_HEIGHT` | no | `768` | Lower = faster |
| `OPENROUTER_IMAGE_MODEL` | no | `google/gemini-2.5-flash-image-preview` | For paid OpenRouter image gen |
| `LUMEN_TOKEN` | only if `IMAGE_PROVIDER=lumen` | — | Bearer token for lumenpro.io |
| `LUMEN_MCP_URL` | no | `https://app.lumenpro.io/mcp` | |
| `ELEVENLABS_API_KEY` | no | — | Leave blank to disable audio (falls back to browser TTS) |
| `ELEVENLABS_VOICE_ID` | no | `21m00Tcm4TlvDq8ikWAM` | Voice for narration |
| `ELEVENLABS_MODEL_ID` | no | `eleven_turbo_v2_5` | TTS model |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | — | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | — | Public client key (replaces legacy `anon`) |
| `SUPABASE_SECRET_KEY` | yes | — | Server-only key (replaces legacy `service_role`). Bypasses RLS. |

Restart `next dev` after changing env vars.

## Image providers

Provider chain: tries the preferred one first, falls through the rest, then to a placeholder if all fail.

- **pollinations** (default) — free, no auth, watermark on anonymous tier. First-time generations take 30–60s.
- **openrouter** — paid (~$0.04/image with Gemini 2.5 Flash Image), faster and higher quality.
- **lumen** — uses your Lumen MCP server. Tool name and arg shape are auto-detected; if Lumen's API differs from the heuristic, edit `lib/lumen.ts`.

## Persistence model (v1: per-device, no auth)

Each browser gets a random UUID (`localStorage` key `story-device-id`) on first visit. Stories are tagged with this `device_id` and listed at `/library`. There is no login yet — anyone with the same browser sees the same library. The schema reserves a `user_id` column for when Supabase Auth is added.

RLS is enabled with deny-by-default: the publishable key cannot read or write the `stories` table from the browser. Reads and writes flow through:

- `POST /api/generate` — generates and inserts a story
- `GET  /api/library?deviceId=...` — lists a device's stories
- `GET  /story/[id]` — server-renders one story from the DB

## Layout

```
app/
  page.tsx                form (title + description) → /api/generate → /story/[id]
  library/page.tsx        grid of saved stories for this device
  story/
    page.tsx              fallback viewer reading sessionStorage
    [id]/page.tsx         server-fetches story by id from Supabase
    StoryViewer.tsx       animated 4-page viewer with play/stop narration
  api/
    generate/route.ts     orchestrator: text → images + audio → insert → return { id, story }
    library/route.ts      lists stories filtered by deviceId

lib/
  openrouter.ts           story text generation (4 pages + characterSheet)
  images.ts               provider router with fallback chain
  pollinations.ts         free Pollinations.ai image fetch
  openrouterImage.ts      OpenRouter image gen (paid)
  lumen.ts                MCP client for Lumen
  elevenlabs.ts           ElevenLabs narration
  supabase/
    server.ts             admin client (uses SUPABASE_SECRET_KEY)
    browser.ts            public client (uses publishable key)
  deviceId.ts             localStorage-backed device UUID
  types.ts                Story / StoryPage types

supabase/
  migrations/0001_stories.sql   stories table + RLS
```

## Deployment

Deployed to Vercel from `main`. To replicate:

1. Push to a GitHub repo and import it into Vercel (Framework preset: Next.js).
2. Add all required env vars in **Project Settings → Environment Variables**. Note: `SUPABASE_SECRET_KEY` must use the *Sensitive* type and cannot target `development` (production + preview only).
3. Apply the SQL migration in the Supabase dashboard.
4. Vercel redeploys automatically on push to `main`.

## Notes

- API route runs on Node (not Edge) — MCP SDK requires it.
- Generation takes 30s–2min depending on provider and image size; the form shows a progress message.
- Story is always 4 pages — the schema is enforced after the LLM returns.
- A refresh on `/story` (without an `[id]`) redirects home, because that view reads from `sessionStorage`. Refreshing `/story/[id]` works because it server-renders from Supabase.

## License

MIT
