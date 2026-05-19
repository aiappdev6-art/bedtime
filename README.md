# Bedtime — Kid's Story Maker

Generate illustrated 4-page kid's stories from a title and description.
Built with Next.js 15, Tailwind v4, framer-motion.

- LLM (via OpenRouter) writes the story
- Configurable image provider (Pollinations / OpenRouter / Lumen MCP) illustrates it
- ElevenLabs narrates each page (paid option)
- Optional uploaded photo becomes the main character (paid option, uses Gemini)
- MyFatoorah accepts payment in KWD
- Supabase persists stories, auth (phone OTP), orders, uploaded photos, cached PDFs
- A gated `/admin` dashboard moderates stories, manages orders, refunds via MyFatoorah

## User flow

1. **Sign in** — phone number → SMS OTP (via Supabase Auth) on `/login`
2. **Create** — title + description + optional voice (+3 KWD) + optional uploaded character photo (+3 KWD) on `/`
3. **Checkout** — order summary, pay via MyFatoorah hosted page
4. **Generate** — `/story/generating` runs LLM + image gen + narration in parallel (~1–2 min)
5. **View** — `/story/{id}` flips through 4 pages, plays narration if purchased, "Download PDF" button
6. **History** — `/library` (stories) and `/orders` (purchases) for the signed-in user
7. **Admin** — only `ADMIN_EMAIL` can sign in at `/admin/login` (email + password). Manages stories (flag/delete) and orders (refund/retry).

## Pricing

| Option | KWD |
|---|---:|
| Base story | 5.000 |
| + Voice narration | +3.000 |
| + Custom character photo | +3.000 |

All amounts in [`lib/pricing.ts`](lib/pricing.ts), driven by `NEXT_PUBLIC_PRICE_*` env vars.
**Server always recomputes** the total from options — client total is display-only.

## Setup

```bash
npm install
cp .env.example .env.local
# fill in the values below
npm run dev          # http://localhost:3000
npm run build        # full prod build (run before pushing)
npm run lint
```

### One-time Supabase setup

1. Apply all migrations in [`supabase/migrations/`](supabase/migrations) in order, by pasting each `.sql` into the Supabase SQL editor and clicking Run:
   - `0001_stories.sql` — stories table + RLS
   - `0002_moderation.sql` — flagged_at / deleted_at columns
   - `0003_payments_auth.sql` — profiles + orders + auto-create-profile trigger
   - `0004_storage_character_uploads.sql` — private `character-uploads` bucket
   - `0005_storage_stories_pdf.sql` — private `stories-pdf` bucket (PDF cache)
2. **Enable phone OTP**: Dashboard → Authentication → Providers → **Phone → Enable** and plug in an SMS gateway (Twilio Verify, Vonage, MessageBird, or Textlocal). Without this, `signInWithOtp` will fail at runtime.
3. **Create the admin user** manually via the Supabase Auth UI (email + password). Set `ADMIN_EMAIL` in your env to match exactly.

### One-time MyFatoorah setup

1. Create an account at https://myfatoorah.com (sandbox = `apitest.myfatoorah.com`).
2. Copy your **API key** into `MYFATOORAH_API_KEY`.
3. In the portal, configure:
   - **CallbackUrl**: `https://<your-domain>/api/payment/callback`
   - **ErrorUrl**: `https://<your-domain>/payment/error`
   - **Webhook**: `https://<your-domain>/api/payment/webhook` — generate a secret and set `MYFATOORAH_WEBHOOK_SECRET`. (Without the secret we accept all webhook bodies — dev mode only.)
4. For local dev with webhooks: use ngrok or Cloudflare Tunnel and set `NEXT_PUBLIC_APP_URL` to the tunnel URL.

## Environment variables

The required minimum to boot is bolded. Everything else is optional.

### Core

| Var | Required | Default | Notes |
|---|---|---|---|
| **`OPENROUTER_API_KEY`** | yes | — | Story text generation |
| `OPENROUTER_MODEL` | no | `openai/gpt-4o-mini` | |
| `OPENROUTER_IMAGE_MODEL` | no | `google/gemini-2.5-flash-image-preview` | Used for custom-character orders + paid image gen |
| `IMAGE_PROVIDER` | no | `pollinations` | `pollinations` / `openrouter` / `lumen` |
| `POLLINATIONS_MODEL` / `_TOKEN` | no | — | Only set `MODEL` if you have a `TOKEN` |
| `LUMEN_TOKEN` / `LUMEN_MCP_URL` | only for lumen | — | |
| `ELEVENLABS_API_KEY` | no | — | If unset, voice narration won't work even when paid for. Set this before charging users! |
| `ELEVENLABS_VOICE_ID` | no | `21m00Tcm4TlvDq8ikWAM` | |
| `ELEVENLABS_MODEL_ID` | no | `eleven_turbo_v2_5` | |

### Supabase

| Var | Required | Notes |
|---|---|---|
| **`NEXT_PUBLIC_SUPABASE_URL`** | yes | |
| **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** | yes | Replaces legacy `anon` |
| **`SUPABASE_SECRET_KEY`** | yes | Server-only. Bypasses RLS. On Vercel must be type *Sensitive* (production + preview only — cannot target development). |
| **`ADMIN_EMAIL`** | yes for `/admin` | Only this email may sign in at `/admin/login` |

### MyFatoorah

| Var | Required | Notes |
|---|---|---|
| **`MYFATOORAH_API_KEY`** | yes for payments | Sandbox or live token |
| `MYFATOORAH_BASE_URL` | no | Defaults to sandbox `https://apitest.myfatoorah.com`. Set to `https://api.myfatoorah.com` for live |
| `MYFATOORAH_WEBHOOK_SECRET` | recommended | HMAC-SHA256 signing secret. Without it, all webhooks are accepted (dev mode). |

### Pricing (KWD) and app URL

| Var | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_PRICE_BASE_KWD` | `5.000` | |
| `NEXT_PUBLIC_PRICE_VOICE_KWD` | `3.000` | |
| `NEXT_PUBLIC_PRICE_CHARACTER_KWD` | `3.000` | |
| **`NEXT_PUBLIC_APP_URL`** | `http://localhost:3000` | Used to build MyFatoorah CallbackUrl and absolute redirect targets. **Must match your deployed domain in production.** |

Restart `next dev` after env changes — Next only reads `.env.local` at boot.

## Test plan (sandbox)

1. Run the dev server (or a Vercel preview deploy with `MYFATOORAH_BASE_URL=https://apitest.myfatoorah.com`).
2. Go to `/login`, enter your phone in international format (e.g. `+96599887766`), enter the SMS code.
3. On `/`, fill in title + description. Optionally tick voice / upload character photo. Confirm the total updates.
4. Click "Continue to payment". Verify you land on `/story/checkout?orderId=...`.
5. Click "Pay with MyFatoorah". You should be redirected to the hosted payment page.
6. Use a sandbox card. MyFatoorah test cards: `5453010000064154` exp `05/21` CVV `100` (KNET sandbox is also available in the portal).
7. After payment, you're returned to `/api/payment/callback`, which re-verifies and redirects to `/story/generating`.
8. Wait ~1–2 min. You should land on `/story/{id}` showing your 4-page story.
9. Verify the audio player is shown iff you ticked voice.
10. Verify the main character matches your uploaded photo iff you uploaded one (stylised as a cartoon).
11. Click "Download PDF" → a `.pdf` file downloads. Second click should be near-instant (served from cache).
12. Visit `/orders` and `/library` — your purchase and story should appear.

### Admin checks

1. Sign in at `/admin/login` with `ADMIN_EMAIL`.
2. Dashboard shows revenue + refund counts.
3. `/admin/orders` lists your test order. Try the **Refund** button → enter a reason → confirm. The order should flip to `refunded` and the story should disappear from `/library`.
4. To test stuck-state recovery: in SQL editor manually update an order to `status='consumed', story_id=null` → it shows the **Retry** button → click → flip back to `paid` → user can re-trigger generation.

## Two Supabase clients

| File | Key | Use for |
|---|---|---|
| `lib/supabase/server.ts` (`supabaseAdmin`) | `SUPABASE_SECRET_KEY` | Server-only writes/reads that bypass RLS. **Never import in a client component.** |
| `lib/supabase/ssr.ts` (`createSupabaseServerClient`) | publishable, with cookies | Reading the current user's session in server components and route handlers |
| `lib/supabase/browser.ts` (`supabaseBrowser`) | publishable, browser cookies | Client components signing in/out |

## Layout

```
app/
  page.tsx                          create form (auth-gated)
  login/page.tsx                    phone OTP login
  library/page.tsx                  user's stories
  orders/page.tsx                   user's order history
  payment/error/page.tsx            after a failed/cancelled payment
  story/
    page.tsx                        legacy sessionStorage viewer
    [id]/page.tsx                   server-fetches a story; checks ownership
    checkout/page.tsx               order summary + "Pay with MyFatoorah"
    generating/page.tsx             post-payment runner → /story/{id}
    StoryViewer.tsx                 animated 4-page viewer + "Download PDF"
  admin/
    page.tsx                        dashboard (stats + revenue)
    stories/                        moderation
    orders/                         orders table + refund/retry actions
    AdminNav.tsx                    nav tabs
    layout.tsx                      defence-in-depth admin gate
  api/
    generate/route.ts               consumes a paid order → text+images+audio → story row
    library/route.ts                lists current user's stories
    orders/route.ts                 creates a pending order; server-recomputes price
    orders/mine/route.ts            current user's order history
    upload/character/route.ts       uploads to character-uploads/{user_id}/{uuid}
    payment/initiate/route.ts       /v2/SendPayment → returns InvoiceURL
    payment/callback/route.ts       user-return endpoint; re-verifies status
    payment/webhook/route.ts        server-to-server webhook; idempotent
    story/[id]/pdf/route.ts         renders + caches PDF
    admin/stories/[id]/route.ts     flag / delete moderation
    admin/orders/[id]/refund/...    MyFatoorah refund + soft-delete story
    admin/orders/[id]/retry/...     unstick a consumed-no-story order

lib/
  openrouter.ts                     story text gen (always 4 pages)
  images.ts                         provider router with fallback chain
  openrouterImage.ts                Gemini gen; accepts an optional reference photo
  pollinations.ts                   free Pollinations.ai image fetch
  lumen.ts                          MCP client for Lumen
  elevenlabs.ts                     narration TTS
  characterReference.ts             downloads + base64-encodes uploaded photo
  pdf.tsx                           @react-pdf/renderer storybook layout
  myfatoorah.ts                     SendPayment / getPaymentStatus / MakeRefund / verify webhook HMAC
  pricing.ts                        single source of truth for prices
  adminGate.ts                      shared requireAdmin + checkOrigin helpers
  supabase/
    server.ts                       admin client
    ssr.ts                          cookie-aware server client
    browser.ts                      cookie-aware browser client
  deviceId.ts                       legacy localStorage UUID (kept for migration)
  safeNext.ts                       sanitises ?next= redirect targets
  types.ts                          Story / StoryPage types

supabase/migrations/                run these in order in Supabase SQL editor
```

## Deployment (Vercel)

1. Push to GitHub and import into Vercel (Framework: Next.js).
2. Add env vars in **Project Settings → Environment Variables**. `SUPABASE_SECRET_KEY` and `MYFATOORAH_API_KEY` should be type *Sensitive*. Sensitive vars cannot target `development` (production + preview only).
3. Apply all SQL migrations in Supabase.
4. Enable phone OTP and set up an SMS gateway in Supabase.
5. Set MyFatoorah CallbackUrl / ErrorUrl / Webhook URL to your real domain.
6. Set `NEXT_PUBLIC_APP_URL` to the deployed domain (no trailing slash).

## Notes

- API routes run on **Node** (not Edge) — MCP SDK + `@react-pdf/renderer` require it.
- Story generation has `maxDuration = 300` (5 min). PDF rendering has `maxDuration = 60`.
- `image generation never throws` — provider failures cascade to a picsum placeholder. Exception: when a reference photo is provided, only OpenRouter is tried (other providers can't use the photo) — failure goes straight to placeholder rather than producing a non-personalised image.
- Order state machine: `pending → paid → consumed` (happy path), or `pending → failed` / `paid → refunded` / `consumed → refunded`.
- Two webhooks fire on payment: the user-return redirect (`/api/payment/callback`) and the server-to-server webhook (`/api/payment/webhook`). Both re-verify the status with MyFatoorah and are idempotent.

## License

MIT
