import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { renderStoryPdf } from "@/lib/pdf";
import type { Story, StoryPage } from "@/lib/types";

export const runtime = "nodejs";
// Cover + 4 pages with base64-inlined images can take ~5-10s on cold start.
export const maxDuration = 60;

const BUCKET = "stories-pdf";

function sanitizeFilename(title: string): string {
  return (
    title
      .replace(/[^a-z0-9\s-]/gi, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "story"
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Auth.
  const supa = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Load + ownership check (legacy device-only stories also allowed for owner).
  const { data: row, error } = await supabaseAdmin
    .from("stories")
    .select("id, title, pages, user_id, deleted_at")
    .eq("id", id)
    .single();
  if (error || !row || row.deleted_at) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }
  if (row.user_id && row.user_id !== user.id) {
    return NextResponse.json({ error: "Not your story" }, { status: 403 });
  }

  const cachePath = `${row.id}.pdf`;
  const filename = `${sanitizeFilename(row.title)}.pdf`;

  // Cache check.
  const cached = await supabaseAdmin.storage.from(BUCKET).download(cachePath);
  if (cached.data) {
    const buf = Buffer.from(await cached.data.arrayBuffer());
    return pdfResponse(buf, filename);
  }

  // Render fresh.
  const story: Story = {
    title: row.title,
    pages: row.pages as StoryPage[],
  };

  let buffer: Buffer;
  try {
    buffer = await renderStoryPdf(story);
  } catch (err) {
    console.error("[/api/story/[id]/pdf] render", err);
    return NextResponse.json(
      { error: "Failed to render PDF" },
      { status: 500 },
    );
  }

  // Cache (best-effort — failure here doesn't block the download).
  const upload = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(cachePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upload.error) {
    console.error("[/api/story/[id]/pdf] cache upload", upload.error);
  }

  return pdfResponse(buffer, filename);
}

function pdfResponse(buf: Buffer, filename: string): Response {
  // Wrap the Node Buffer in a Uint8Array view so Response sees an ArrayBuffer
  // body (Buffer extends Uint8Array but its BYTES_PER_ELEMENT confuses some
  // edge runtimes).
  const bytes = new Uint8Array(buf);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
