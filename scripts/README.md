# Scripts

Standalone Node scripts for one-off ops against the Supabase Postgres.
Both connect via the **Supavisor pooler** (IPv4-reachable) because the
direct `db.{ref}.supabase.co` host is IPv6-only on free-tier projects.

## Connection string

Grab it from Supabase dashboard → Project Settings → **Database** → "Connection string" → **Connection pooling** tab (transaction mode, port 6543).

It looks like:

```
postgresql://postgres.{project-ref}:{password}@aws-1-{region}.pooler.supabase.com:6543/postgres
```

If your password contains URI-special characters (`@`, `:`, `/`, `#`, `?`, `%`), URL-encode them — e.g. `@` → `%40`.

The scripts pre-resolve the hostname via `1.1.1.1` because the local resolver may not be configured, and they pass the resolved IP directly to `pg` (`pg`'s built-in `getaddrinfo` doesn't honour `dns.setServers`).

## migrate.mjs

Run one or more SQL files in order. Idempotent migrations only (the ones in `supabase/migrations/` are written this way).

```bash
PG_CONN_STRING='postgresql://...' \
  node scripts/migrate.mjs \
  supabase/migrations/0003_payments_auth.sql \
  supabase/migrations/0004_storage_character_uploads.sql \
  supabase/migrations/0005_storage_stories_pdf.sql
```

## verify-schema.mjs

Checks that all expected tables, RLS policies, triggers, and storage buckets exist.

```bash
PG_CONN_STRING='postgresql://...' node scripts/verify-schema.mjs
```

Add more checks to the `checks` array as the schema grows.
