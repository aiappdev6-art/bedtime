import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, checkOrigin } from "@/lib/adminGate";

export const runtime = "nodejs";

// Flip a stuck `consumed`-without-story order back to `paid` so the user can
// retry generation from /story/generating. Idempotent: only acts on rows that
// are currently consumed and have no story_id.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkOrigin(req))
    return NextResponse.json({ error: "bad origin" }, { status: 403 });

  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({ status: "paid", consumed_at: null, failure_reason: null })
    .eq("id", id)
    .eq("status", "consumed")
    .is("story_id", null)
    .select("id");

  if (error) {
    console.error("[admin:retry]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      {
        error:
          "Order is not in a retryable state (must be consumed with no story).",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
