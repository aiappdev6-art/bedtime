import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";

export const runtime = "nodejs";

export async function GET() {
  const supa = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("stories")
    .select("id, title, description, created_at, pages")
    .eq("user_id", user.id)
    .is("deleted_at", null)
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
