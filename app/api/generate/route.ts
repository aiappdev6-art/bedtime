import { NextRequest, NextResponse } from "next/server";
import { generateStoryText } from "@/lib/openrouter";
import { generateImage } from "@/lib/images";
import type { Story } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { title, description } = await req.json();
    if (!title || !description) {
      return NextResponse.json(
        { error: "title and description are required" },
        { status: 400 },
      );
    }

    const generated = await generateStoryText(title, description);

    const images = await Promise.all(
      generated.pages.map((p) => generateImage(p.imagePrompt)),
    );

    const story: Story = {
      title: generated.title || title,
      pages: generated.pages.map((p, i) => ({
        text: p.text,
        imagePrompt: p.imagePrompt,
        imageUrl: images[i],
      })),
    };

    return NextResponse.json({ story });
  } catch (err) {
    console.error("[/api/generate]", err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
