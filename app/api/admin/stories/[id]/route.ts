import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (process.env.ADMIN_EMAIL && user.email !== process.env.ADMIN_EMAIL)
    return null;
  return user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "flag" | "unflag" | "delete" | "restore";
    reason?: string;
  };

  const now = new Date().toISOString();
  let patch: Record<string, unknown> = {};
  switch (body.action) {
    case "flag":
      patch = { flagged_at: now, flagged_reason: body.reason ?? null };
      break;
    case "unflag":
      patch = { flagged_at: null, flagged_reason: null };
      break;
    case "delete":
      patch = { deleted_at: now };
      break;
    case "restore":
      patch = { deleted_at: null };
      break;
    default:
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("stories")
    .update(patch)
    .eq("id", id);

  if (error) {
    console.error("[admin:stories:patch]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
