import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { computeTotal } from "@/lib/pricing";

export const runtime = "nodejs";

type OrderBody = {
  title?: unknown;
  description?: unknown;
  voice?: unknown;
  characterImage?: unknown;
  characterImagePath?: unknown;
};

export async function POST(req: NextRequest) {
  const supa = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as OrderBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const voice = body.voice === true;
  const characterImage = body.characterImage === true;
  const characterImagePath =
    typeof body.characterImagePath === "string" ? body.characterImagePath : null;

  if (!title || !description) {
    return NextResponse.json(
      { error: "title and description are required" },
      { status: 400 },
    );
  }
  if (characterImage && !characterImagePath) {
    return NextResponse.json(
      { error: "Character image option enabled but no image was uploaded" },
      { status: 400 },
    );
  }
  // Defence in depth: ensure the uploaded path actually belongs to this user.
  if (characterImagePath && !characterImagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json(
      { error: "Character image path does not belong to this user" },
      { status: 403 },
    );
  }

  const amountKwd = computeTotal({ voice, characterImage });

  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: user.id,
      amount_kwd: amountKwd,
      options: {
        title,
        description,
        voice,
        characterImage,
        characterImagePath,
      },
      status: "pending",
    })
    .select("id, amount_kwd")
    .single();

  if (error) {
    console.error("[/api/orders] insert", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orderId: data.id, amountKwd: data.amount_kwd });
}
