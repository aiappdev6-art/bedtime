# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js app that turns a kid's story title + description into an animated 4-page illustrated storybook with narration. Each story is a **paid** purchase via MyFatoorah (KWD): base 5 KD, +3 KD for voice narration, +3 KD for using an uploaded photo as the main character. Stories are persisted in Supabase per authenticated user (phone-OTP login), exposed at `/library`, and downloadable as PDF. A gated `/admin` dashboard moderates stories and manages orders/refunds.

## Stack

- Next.js 15 (App Router) + React 19, TypeScript, Tailwind CSS v4 (no config file — `@theme` in CSS)
- framer-motion for page transitions
- `@modelcontextprotocol/sdk` Streamable HTTP client for Lumen image MCP
- `@supabase/supabase-js` + `@supabase/ssr` for persistence, phone-OTP auth, storage
- ElevenLabs HTTP API for narration (paid option)
- MyFatoorah HTTP API for KWD payments
- `@react-pdf/renderer` for server-rendered PDF exports

## Big picture

Five layers stacked on the same Next.js app:

### 1. Auth (phone OTP for users, email for admin)
- End users: `signInWithOtp({ phone })` → `verifyOtp({ phone, token, type: "sms" })` (`app/login/page.tsx`). The SMS provider is configured **in the Supabase dashboard**, not in our code.
- Admin: email + password via Supabase Auth (`app/admin/login`). `middleware.ts` enforces `ADMIN_EMAIL` match.
- `profiles` table mirrors `auth.users` and is auto-populated by a trigger (`0003_payments_auth.sql`) — used for joining phone/email into the admin orders view.
- `middleware.ts` gates everything outside `/api/*` and `/login` and `/admin/login`. Admin paths additionally require `user.email === ADMIN_EMAIL`.

### 2. Order pipeline (the new money path)
1. User fills the form on `/`. The client computes a total via `lib/pricing.ts` and uploads any character photo to `POST /api/upload/character` (writes to private bucket `character-uploads/{user_id}/{uuid}.{ext}`).
2. `POST /api/orders` creates a `pending` order. **Server recomputes the amount from `computeTotal()` and never trusts the client-submitted price.** The `options` jsonb stores `{title, description, voice, characterImage, characterImagePath}`.
3. `/story/checkout?orderId=...` shows the order summary. Clicking "Pay with MyFatoorah" calls `POST /api/payment/initiate`, which calls `/v2/SendPayment` with `NotificationOption: "LNK"` and returns the hosted `InvoiceURL`.
4. After payment, MyFatoorah redirects to `GET /api/payment/callback?orderId=...&paymentId=...`. This route **re-verifies** with `/v2/getPaymentStatus` (never trusts the query string), flips the order `pending → paid`, and redirects to `/story/generating`. A server-to-server `POST /api/payment/webhook` may also fire — it does the same idempotent re-verification.
5. `/story/generating` is a server-guarded page (owner + status check, redirects to `/story/{id}` if generation already done). Its client `GeneratingRunner` POSTs `/api/generate` exactly once.

### 3. Generation pipeline (`/api/generate`)
Now consumes a paid order rather than free-form input. Runs on **Node runtime** with `maxDuration = 300`. Flow:

1. Load order, verify owner + `status === 'paid'` + not already linked. If `story_id` already set, return existing.
2. **Atomic claim**: `UPDATE orders SET status='consumed' WHERE id=... AND status='paid'`. Zero rows updated = another request beat us → 409. Prevents double-spend on parallel requests.
3. `lib/openrouter.ts` returns `{title, characterSheet, pages[4]}`. Validation enforces exactly 4 pages.
4. If `options.characterImage`: `lib/characterReference.ts` downloads the photo once and base64-encodes it. Failure here is logged but doesn't abort generation (order is already paid; we fall back to text-only images).
5. **In parallel for each page:**
   - `lib/images.ts` generates an illustration. When `referenceImageDataUri` is set, **only OpenRouter (Gemini) is tried** — Pollinations/Lumen can't use a reference photo. Failure goes to picsum placeholder (never to a non-personalised provider).
   - `lib/elevenlabs.ts` generates narration **only when `options.voice` is true**. Otherwise audios is an array of `null`.
6. Insert the story row with `user_id` set. Update the order to link `story_id`. If step 6 fails after the claim, the order is stuck in `consumed` with no `story_id` — admin can flip it back to `paid` via the **Retry** button or refund.

### 4. Story viewing + PDF
- `/story/{id}` server-renders the row, checks ownership (legacy stories without `user_id` are also viewable by anyone authenticated — kept for backward compat).
- `app/story/StoryViewer.tsx` is the animated 4-page viewer. Audio Play/Stop is **hidden entirely** when narration wasn't purchased (no silent browser-TTS fallback that would devalue the upsell). "Download PDF" links straight to `/api/story/[id]/pdf`.
- PDF route: auth + ownership check, cache check (downloads `{id}.pdf` from `stories-pdf` bucket if present), otherwise renders via `lib/pdf.tsx` (`@react-pdf/renderer`, A5 landscape: cover + one page per story page), uploads to cache best-effort, streams with `Content-Disposition: attachment`.

### 5. Admin dashboard
- All `/admin/*` paths gated by `middleware.ts` (must be `ADMIN_EMAIL`); same check repeated in `app/admin/layout.tsx`.
- `/admin/orders` lists orders with filters (status, since-date). `OrderActions.tsx` exposes:
  - **Refund** (paid/consumed orders with a `myfatoorah_payment_id`) → calls `POST /api/admin/orders/[id]/refund` → MyFatoorah `MakeRefund` → marks order `refunded` → **soft-deletes** the linked story so the customer can't keep enjoying refunded content.
  - **Retry** (consumed orders with no `story_id`) → calls `POST /api/admin/orders/[id]/retry` → atomic flip back to `paid`.
- Admin API routes use shared `lib/adminGate.ts` (`requireAdmin` + `checkOrigin` for CSRF). All mutations are POST with same-origin checks.
- Dashboard shows revenue (sum `amount_kwd` for `paid`+`consumed`), revenue today, refund count, alongside the original story stats.

## Two Supabase clients — don't mix them up

| File | Key | Use for |
|---|---|---|
| `lib/supabase/server.ts` (`supabaseAdmin`) | `SUPABASE_SECRET_KEY` | Server-only writes/reads that bypass RLS. **Never import in a client component.** |
| `lib/supabase/ssr.ts` (`createSupabaseServerClient`) | publishable, with cookies | Reading the current user's session in server components / route handlers |
| `lib/supabase/browser.ts` (`supabaseBrowser`) | publishable, browser cookies | Client components signing in/out |

If you're tempted to use `supabaseBrowser` to read `stories` or `orders` directly from the client — don't. RLS will return nothing (or only the user's own row, which defeats joins).

## Order state machine

```
   POST /api/orders
         │
         ▼
     pending  ──(MyFatoorah failed/cancelled)──►  failed
         │
         │ (MyFatoorah Paid + callback or webhook)
         ▼
       paid  ──(admin refund)──►  refunded
         │
         │ (atomic claim in /api/generate)
         ▼
     consumed  ──(generation crash, story_id stays null; admin retry)──►  paid
         │                                                                  ▲
         │ (story inserted + linked)                                        │
         ▼                                                                  │
   consumed + story_id ──(admin refund)──►  refunded + soft-deleted story
```

Refunded orders never come back to life — start a new order instead.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build — run this to verify before pushing
npm run lint
```

Vercel auto-deploys from `main`. There is no test suite — manual happy/failure paths are documented in `README.md`.

## Conventions & gotchas

- **Story is always 4 pages.** Enforced in `lib/openrouter.ts` after the LLM returns. If changing, update the system prompt *and* the validation check *and* `lib/pdf.tsx`'s page generation.
- **Pricing source of truth is `lib/pricing.ts`** — both client and server import `computeTotal()`. Server **must** recompute before charging; client total is display-only. Drift between order creation and payment-initiate is checked in `/api/payment/initiate` (refuses to charge if mismatched).
- **Image generation never throws.** Provider failures cascade silently; the last fallback is picsum. **Exception:** when a reference photo is set, only OpenRouter is tried — failure goes straight to picsum (never to a non-personalised provider, which would silently violate the paid character option).
- **Image URLs are base64 data URIs** (server-fetched and inlined). `@react-pdf/renderer`'s `<Image>` accepts data URIs directly. Don't change this without auditing the PDF renderer.
- **Order claim atomicity**: the `paid → consumed` flip uses `.eq("status", "paid")` to enforce a single-winner rule. Any code that touches `orders.status` should mirror this pattern (idempotent on concurrent webhook delivery, retry button, etc.).
- **Webhook & callback both re-verify** with `/v2/getPaymentStatus`. Never trust the query string or webhook body for the actual paid status — only use them as identifiers to look up.
- **MyFatoorah webhook signature**: HMAC-SHA256 of the raw body with `MYFATOORAH_WEBHOOK_SECRET`, base64. If the secret is unset, all webhooks are accepted (dev mode). Always set it in production.
- **Phone OTP requires Supabase dashboard config** — enable Auth → Providers → Phone with an SMS gateway. There is no code-level SMS provider.
- **Run migrations manually.** SQL files in `supabase/migrations/` are reference only — no migration runner. Paste them into the Supabase SQL editor **in order** (0001 → 0005).
- **`.mcp.json` uses `${LUMEN_TOKEN}` env expansion.** Never hardcode the token there.
- **Tailwind v4** — no `tailwind.config.ts`. Config goes in CSS via `@theme`. Don't recreate the v3 config.
- **Middleware matcher** is `/((?!api|login|_next/static|_next/image|favicon.ico).*)`. `/api/*` is excluded so MyFatoorah's server-to-server webhook works without cookies, and so the callback route can run regardless of session state.
- **`NEXT_PUBLIC_APP_URL`** must be set correctly in every environment — it's used to build MyFatoorah's CallbackUrl. If it's wrong, the user never returns to your app.
- **Refunds soft-delete the story** (`deleted_at` set). The row stays in the DB for audit; `/story/[id]` and `/library` both filter on `deleted_at IS NULL`.
