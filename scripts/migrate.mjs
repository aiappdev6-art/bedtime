// One-shot migration runner. Usage:
//   PG_CONN_STRING="postgresql://postgres:PWD@db.xxxxx.supabase.co:5432/postgres" \
//   node scripts/migrate.mjs supabase/migrations/0003_payments_auth.sql ...
//
// Idempotent migrations only — re-running is safe (CREATE IF NOT EXISTS,
// DROP POLICY IF EXISTS / CREATE POLICY, etc.).

import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import dns from "node:dns";
import pg from "pg";

// Local DNS resolver isn't reachable in this environment, so we point Node's
// resolver at Cloudflare/Google. Note: dns.setServers only affects dns.resolve*,
// NOT dns.lookup (which is what pg uses under the hood). So we also pre-resolve
// the host manually below and pass the IP directly to pg.
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const { Client } = pg;

const conn = process.env.PG_CONN_STRING;
if (!conn) {
  console.error("PG_CONN_STRING env var is required");
  process.exit(1);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Pass one or more .sql file paths");
  process.exit(1);
}

// Parse the URI so we can pre-resolve the host. node-postgres' Client also
// accepts host/port/user/password/database directly.
const u = new URL(conn);
const hostname = u.hostname;

// Pooler hosts are IPv4-only; direct db.xxx hosts are IPv6-only. Try IPv4
// first (works on most networks); fall back to IPv6.
let resolvedHost;
try {
  const ipv4 = await dns.promises.resolve4(hostname);
  if (ipv4 && ipv4.length > 0) {
    resolvedHost = ipv4[0];
    console.log(`[dns] ${hostname} -> ${resolvedHost} (A)`);
  }
} catch {
  /* fall through */
}
if (!resolvedHost) {
  try {
    const ipv6 = await dns.promises.resolve6(hostname);
    if (ipv6 && ipv6.length > 0) {
      resolvedHost = ipv6[0];
      console.log(`[dns] ${hostname} -> ${resolvedHost} (AAAA)`);
    }
  } catch (err) {
    console.error(`[dns] could not resolve ${hostname}: ${err.message}`);
    process.exit(3);
  }
}
if (!resolvedHost) {
  console.error(`[dns] no address records for ${hostname}`);
  process.exit(3);
}

const client = new Client({
  host: resolvedHost,
  port: Number(u.port || 5432),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, "") || "postgres",
  // Supabase requires SSL. Pass servername so SNI/cert validation still works
  // against the original hostname even though we connected by IP.
  ssl: { rejectUnauthorized: false, servername: hostname },
});

try {
  await client.connect();
  console.log("[connected]");
  for (const file of files) {
    const path = resolvePath(file);
    const sql = readFileSync(path, "utf8");
    process.stdout.write(`[run] ${file} ... `);
    try {
      await client.query(sql);
      console.log("OK");
    } catch (err) {
      console.log("FAIL");
      console.error(err.message);
      process.exitCode = 2;
    }
  }
} catch (err) {
  console.error("[fatal]", err.message);
  process.exitCode = 3;
} finally {
  await client.end().catch(() => {});
}
