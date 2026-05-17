import { NextRequest, NextResponse } from "next/server";
import { generateStoryText } from "@/lib/openrouter";
import { generateImage } from "@/lib/images";
import { generateNarration } from "@/lib/elevenlabs";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import type { Story } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const supa = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { title, description, deviceId } = await req.json();
    if (!title || !description) {
      return NextResponse.json(
        { error: "title and description are required" },
        { status: 400 },
      );
    }

    const generated = await generateStoryText(title, description);
    const storySeed = Math.floor(Math.random() * 1_000_000);

    const [images, audios] = await Promise.all([
      Promise.all(
        generated.pages.map((p) =>
          generateImage(p.imagePrompt, {
            characterSheet: generated.characterSheet,
            seed: storySeed,
          }),
        ),
      ),
      Promise.all(generated.pages.map((p) => generateNarration(p.text))),
    ]);

    const story: Story = {
      title: generated.title || title,
      pages: generated.pages.map((p, i) => ({
        text: p.text,
        imagePrompt: p.imagePrompt,
        imageUrl: images[i],
        audioUrl: audios[i],
      })),
    };

    let id: string | null = null;
    const { data, error } = await supabaseAdmin
      .from("stories")
      .insert({
        user_id: user.id,
        device_id: deviceId ?? user.id,
        title: story.title,
        description,
        pages: story.pages,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[supabase:insert]", error);
    } else {
      id = data.id;
    }

    return NextResponse.json({ id, story });
  } catch (err) {
    console.error("[/api/generate]", err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
