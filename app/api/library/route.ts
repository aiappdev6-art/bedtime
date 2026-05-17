import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("stories")
    .select("id, title, description, created_at, pages")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[/api/library]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stories = (data ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    created_at: s.created_at,
    coverUrl:
      Array.isArray(s.pages) && s.pages[0]?.imageUrl ? s.pages[0].imageUrl : null,
  }));

  return NextResponse.json({ stories });
}
