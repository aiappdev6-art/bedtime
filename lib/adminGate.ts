// Shared admin gate for /api/admin/* routes.
// - requireAdmin(): checks Supabase session + ADMIN_EMAIL match.
// - checkOrigin(): blocks cross-site POST/PATCH/DELETE attempts.
//
// Both checks are defence in depth — middleware already gates /admin pages —
// but API routes are reachable directly so we re-check here.

import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (process.env.ADMIN_EMAIL && user.email !== process.env.ADMIN_EMAIL)
    return null;
  return user;
}

export function checkOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // server-to-server / curl
  const host = req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
