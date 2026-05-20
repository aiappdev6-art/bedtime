// Verify the migrations actually landed. Reports a checklist of expected
// objects: tables, indexes, RLS, trigger, storage buckets.

import dns from "node:dns";
import pg from "pg";

const conn = process.env.PG_CONN_STRING;
if (!conn) { console.error("PG_CONN_STRING required"); process.exit(1); }

const u = new URL(conn);
const hostname = u.hostname;

dns.setServers(["1.1.1.1", "8.8.8.8"]);

let resolvedHost;
try {
  const a = await dns.promises.resolve4(hostname);
  if (a?.length) resolvedHost = a[0];
} catch {}
if (!resolvedHost) {
  try {
    const a = await dns.promises.resolve6(hostname);
    if (a?.length) resolvedHost = a[0];
  } catch {}
}
if (!resolvedHost) { console.error("DNS fail"); process.exit(2); }

const client = new pg.Client({
  host: resolvedHost,
  port: Number(u.port || 5432),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, "") || "postgres",
  ssl: { rejectUnauthorized: false, servername: hostname },
});

await client.connect();

const checks = [
  {
    label: "Table public.profiles",
    sql: `select 1 from information_schema.tables where table_schema='public' and table_name='profiles'`,
  },
  {
    label: "Table public.orders",
    sql: `select 1 from information_schema.tables where table_schema='public' and table_name='orders'`,
  },
  {
    label: "RLS enabled on profiles",
    sql: `select 1 from pg_tables where schemaname='public' and tablename='profiles' and rowsecurity=true`,
  },
  {
    label: "RLS enabled on orders",
    sql: `select 1 from pg_tables where schemaname='public' and tablename='orders' and rowsecurity=true`,
  },
  {
    label: "Policy profiles_self_read",
    sql: `select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_read'`,
  },
  {
    label: "Policy orders_self_read",
    sql: `select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_self_read'`,
  },
  {
    label: "Trigger on_auth_user_created",
    sql: `select 1 from pg_trigger where tgname='on_auth_user_created'`,
  },
  {
    label: "Bucket character-uploads",
    sql: `select 1 from storage.buckets where id='character-uploads'`,
  },
  {
    label: "Bucket stories-pdf",
    sql: `select 1 from storage.buckets where id='stories-pdf'`,
  },
  {
    label: "Storage policy character_uploads_owner_read",
    sql: `select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='character_uploads_owner_read'`,
  },
  {
    label: "Storage policy character_uploads_owner_insert",
    sql: `select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='character_uploads_owner_insert'`,
  },
  {
    label: "Column public.stories.voice",
    sql: `select 1 from information_schema.columns where table_schema='public' and table_name='stories' and column_name='voice'`,
  },
];

let pass = 0, fail = 0;
for (const c of checks) {
  const r = await client.query(c.sql);
  if (r.rowCount > 0) { console.log(`✓ ${c.label}`); pass++; }
  else                { console.log(`✗ ${c.label}`); fail++; }
}

console.log(`\n${pass}/${pass + fail} checks passed.`);
await client.end();
process.exit(fail === 0 ? 0 : 1);
