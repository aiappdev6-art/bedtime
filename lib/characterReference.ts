// Load a user-uploaded character reference photo from Supabase Storage and
// return it as a base64 data URI suitable for OpenRouter chat completions
// (Gemini 2.5 Flash Image accepts image_url with data: URIs).
//
// Called once per /api/generate run; the result is reused for all 4 pages
// so we don't hammer Storage 4x.

import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "character-uploads";

// Cap to keep prompts under model size limits and avoid sending megabytes
// per page. The upload endpoint already restricts to 5MB but we re-check here.
const MAX_BYTES = 5 * 1024 * 1024;

function mimeFromExt(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function loadCharacterReference(
  path: string,
): Promise<{ dataUri: string; mimeType: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error(
      `Failed to download character reference '${path}': ${error?.message ?? "unknown"}`,
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    throw new Error(
      `Character reference too large (${arrayBuffer.byteLength} > ${MAX_BYTES})`,
    );
  }

  const mimeType = data.type || mimeFromExt(path);
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return {
    dataUri: `data:${mimeType};base64,${base64}`,
    mimeType,
  };
}
