# Bedtime — Kid's Story Maker

Generate illustrated 4-page kid's stories from a title and description. Built with Next.js 15, Tailwind v4, and framer-motion. Uses an LLM (via OpenRouter) to write the story and a configurable image provider (Pollinations / OpenRouter / Lumen MCP) to illustrate it.

## How it works

1. Enter a title and a short description.
2. The server calls OpenRouter to write a 4-page story as JSON (`text` + `imagePrompt` per page).
3. For each page, it requests an illustration from the chosen image provider (server-side, returned as a base64 data URI so the browser displays it instantly).
4. A framer-motion viewer flips through the pages with animated transitions.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript, Tailwind CSS v4
- framer-motion (page transitions)
- `@modelcontextprotocol/sdk` (Lumen MCP client)

## Setup

```bash
npm install
cp .env.example .env.local
# fill in OPENROUTER_API_KEY (required)
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Var | Required | Default | Notes |
|---|---|---|---|
| `OPENROUTER_API_KEY` | yes | — | Used for story text |
| `OPENROUTER_MODEL` | no | `openai/gpt-4o-mini` | Any OpenRouter chat model |
| `IMAGE_PROVIDER` | no | `pollinations` | `pollinations` (free), `openrouter` (paid), `lumen` |
| `POLLINATIONS_MODEL` | no | _(anonymous)_ | Set `flux`/`turbo` only with a `POLLINATIONS_TOKEN` |
| `POLLINATIONS_TOKEN` | no | — | Removes watermark |
| `POLLINATIONS_WIDTH` / `_HEIGHT` | no | `768` | Lower = faster |
| `OPENROUTER_IMAGE_MODEL` | no | `google/gemini-2.5-flash-image-preview` | For paid OpenRouter image gen |
| `LUMEN_TOKEN` | only if `IMAGE_PROVIDER=lumen` | — | Bearer token for lumenpro.io |
| `LUMEN_MCP_URL` | no | `https://app.lumenpro.io/mcp` | |

## Image providers

Provider chain: tries the preferred one first, falls through the rest, then to a placeholder if all fail.

- **pollinations** (default) — free, no auth, watermark on anonymous tier. First-time generations take 30–60s.
- **openrouter** — paid (~$0.04/image with Gemini 2.5 Flash Image), faster and higher quality.
- **lumen** — uses your Lumen MCP server. Tool name and arg shape are auto-detected; if Lumen's API differs from the heuristic, edit `lib/lumen.ts`.

## Layout

```
app/
  page.tsx              form (title + description)
  story/
    page.tsx            server wrapper
    StoryViewer.tsx     animated 4-page viewer
  api/generate/route.ts orchestrator: text -> images -> story JSON
lib/
  openrouter.ts         story text generation
  images.ts             provider router with fallback chain
  pollinations.ts       free Pollinations.ai image fetch
  openrouterImage.ts    OpenRouter image gen (paid)
  lumen.ts              MCP client for Lumen
  types.ts              Story / StoryPage types
```

## Notes

- API route runs on Node (not Edge) — MCP SDK requires it.
- Generation takes 30s–2min depending on provider and image size; the form shows a progress message.
- Images are returned as base64 data URIs so the browser doesn't wait on Pollinations after navigation.
- Story is always 4 pages — the schema is enforced after the LLM returns.

## License

MIT
