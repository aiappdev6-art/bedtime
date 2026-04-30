# CLAUDE.md

Guidance for Claude Code working in this repo.

## What this is

A Next.js app that turns a kid's story title + description into an animated 4-page illustrated storybook. Text comes from an LLM via OpenRouter; images come from a configurable provider (Pollinations / OpenRouter image models / Lumen MCP).

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript, Tailwind CSS v4 (PostCSS plugin, no config file)
- framer-motion for page transitions
- `@modelcontextprotocol/sdk` Streamable HTTP client for Lumen
- Node runtime on the API route (not edge — MCP SDK needs Node)

## Layout

- `app/page.tsx` — form (title + description), POSTs to `/api/generate`, stashes story in `sessionStorage`, navigates to `/story`.
- `app/story/StoryViewer.tsx` — client component, reads `sessionStorage`, animates pages with framer-motion.
- `app/api/generate/route.ts` — orchestrates: text → 4 parallel image calls → returns `Story` JSON.
- `lib/openrouter.ts` — OpenRouter chat completions, returns `{ title, pages: [{ text, imagePrompt }] }`. Uses `response_format: json_object`.
- `lib/images.ts` — provider router. Reads `IMAGE_PROVIDER` (`pollinations` | `openrouter` | `lumen`), tries preferred first, falls through the rest, then picsum.
- `lib/pollinations.ts` — builds a Pollinations.ai URL (no API call server-side, browser fetches it). Default provider.
- `lib/openrouterImage.ts` — uses `google/gemini-2.5-flash-image-preview` with `modalities: ["image","text"]`. **Paid** (~$0.04/image).
- `lib/lumen.ts` — MCP client; auto-discovers an image-like tool from `tools/list`. The exact tool name and arg shape are guessed (matches `image|illustrat|picture|draw` in name, `prompt|text|description` in args). If Lumen's API differs, this is where to fix it.
- `lib/types.ts` — `Story`, `StoryPage` types.

## Env vars

Set in `.env.local` (gitignored). Template in `.env.example`.

| Var | Required | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | yes | Story text generation |
| `OPENROUTER_MODEL` | no | Defaults to `openai/gpt-4o-mini` |
| `IMAGE_PROVIDER` | no | `pollinations` (default, free), `openrouter` (paid), `lumen` |
| `POLLINATIONS_MODEL` | no | `flux` (default), `flux-realism`, `turbo` |
| `OPENROUTER_IMAGE_MODEL` | no | Defaults to `google/gemini-2.5-flash-image-preview` |
| `LUMEN_TOKEN` | only if using lumen | Bearer token for lumenpro.io |
| `LUMEN_MCP_URL` | no | Defaults to `https://app.lumenpro.io/mcp` |

Restart the dev server after changing env vars — Next.js only reads them at boot.

## Running

```
npm install
npm run dev    # http://localhost:3000
npm run build  # production build (used to verify changes)
```

## Conventions

- Story is always 4 pages — schema enforced in `openrouter.ts`. If changing, update the system prompt **and** the validation check.
- Image generation is non-blocking from the user's POV: Pollinations returns a URL, the browser does the actual generation request. Don't change this to server-side fetch unless you also add a loading state per page.
- Provider failures cascade silently to the next provider, then to a picsum placeholder. Errors are logged with `[image:<provider>]` prefix — grep server logs to debug.
- `.mcp.json` uses `${LUMEN_TOKEN}` env expansion; never hardcode the token there.

## Gotchas

- **API route timeout**: `maxDuration = 120`. Story text + 4 image generations needs to fit. Pollinations is fastest (URL only, ~instant); OpenRouter image is slowest (~10s/image).
- **Tailwind v4** has no `tailwind.config.ts` — config goes in CSS via `@theme`. Don't recreate the v3 config.
- **MCP client must run on Node runtime**, not Edge. `app/api/generate/route.ts` sets `runtime = "nodejs"` explicitly.
- **sessionStorage** is the story handoff — it survives the client-side nav from `/` to `/story`. A page refresh on `/story` redirects to `/` because the stash is gone. That's intentional.
