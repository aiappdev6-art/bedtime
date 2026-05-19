import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";

export const runtime = "nodejs";

type OrderOptions = {
  title?: string;
  voice?: boolean;
  characterImage?: boolean;
};

// Returns the signed-in user's orders newest first. Strips admin-only fields
// (MyFatoorah ids, failure_reason). Adds a denormalised `pdfReady` so the UI
// can show the download link conditionally.

export async function GET() {
  const supa = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, story_id, amount_kwd, options, status, created_at, paid_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[/api/orders/mine]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = (data ?? []).map((o) => {
    const opts = (o.options ?? {}) as OrderOptions;
    return {
      id: o.id,
      storyId: o.story_id,
      amountKwd: Number(o.amount_kwd),
      status: o.status,
      createdAt: o.created_at,
      paidAt: o.paid_at,
      title: opts.title ?? null,
      voice: !!opts.voice,
      characterImage: !!opts.characterImage,
    };
  });

  return NextResponse.json({ orders });
}
