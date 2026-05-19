import { NextRequest, NextResponse } from "next/server";
import { generateStoryText } from "@/lib/openrouter";
import { generateImage } from "@/lib/images";
import { generateNarration } from "@/lib/elevenlabs";
import { loadCharacterReference } from "@/lib/characterReference";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import type { Story } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type OrderOptions = {
  title?: string;
  description?: string;
  voice?: boolean;
  characterImage?: boolean;
  characterImagePath?: string | null;
};

type OrderRow = {
  id: string;
  user_id: string;
  status: string;
  story_id: string | null;
  options: OrderOptions | null;
};

export async function POST(req: NextRequest) {
  try {
    const supa = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { orderId } = (await req.json().catch(() => ({}))) as {
      orderId?: string;
    };
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    // 1. Load the order. Source of truth for title/description/options.
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status, story_id, options")
      .eq("id", orderId)
      .single<OrderRow>();
    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.user_id !== user.id) {
      return NextResponse.json({ error: "Not your order" }, { status: 403 });
    }
    if (order.story_id) {
      // Already consumed — return the existing story.
      return NextResponse.json({ id: order.story_id });
    }
    if (order.status !== "paid") {
      return NextResponse.json(
        { error: `Order is ${order.status}, cannot generate` },
        { status: 409 },
      );
    }

    const opts = order.options ?? {};
    const title = (opts.title ?? "").trim();
    const description = (opts.description ?? "").trim();
    if (!title || !description) {
      return NextResponse.json(
        { error: "Order missing title/description" },
        { status: 422 },
      );
    }

    // 2. Atomically claim the order so a parallel request can't double-spend.
    //    We flip paid → consumed before doing the (expensive) work.
    const claim = await supabaseAdmin
      .from("orders")
      .update({ status: "consumed", consumed_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "paid")
      .select("id");
    if (claim.error || !claim.data || claim.data.length === 0) {
      return NextResponse.json(
        {
          error:
            "Order was already claimed by another request. If this is a mistake, contact support.",
        },
        { status: 409 },
      );
    }

    // 3. Heavy work. If this fails we leave the order in `consumed` state — admin
    //    can refund or manually flip it back to `paid` for retry.
    const generated = await generateStoryText(title, description);
    const storySeed = Math.floor(Math.random() * 1_000_000);

    const wantVoice = opts.voice === true;
    const characterImagePath =
      opts.characterImage === true ? (opts.characterImagePath ?? null) : null;

    // Load the user's reference photo once (if any) and reuse the data URI
    // for all 4 page-image calls. We do NOT abort generation on failure —
    // the order is already paid, so we fall through to text-only image gen
    // and log loudly for admin diagnostics.
    let referenceImageDataUri: string | null = null;
    if (characterImagePath) {
      try {
        const ref = await loadCharacterReference(characterImagePath);
        referenceImageDataUri = ref.dataUri;
        console.log(
          `[character:reference] loaded ${characterImagePath} (${ref.mimeType})`,
        );
      } catch (err) {
        console.error("[character:reference] load failed:", err);
      }
    }

    const [images, audios] = await Promise.all([
      Promise.all(
        generated.pages.map((p) =>
          generateImage(p.imagePrompt, {
            characterSheet: generated.characterSheet,
            seed: storySeed,
            characterImagePath,
            referenceImageDataUri,
          }),
        ),
      ),
      wantVoice
        ? Promise.all(generated.pages.map((p) => generateNarration(p.text)))
        : Promise.resolve<(string | null)[]>(
            new Array(generated.pages.length).fill(null),
          ),
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

    // 4. Persist the story and link it to the order.
    const { data: storyRow, error: insertErr } = await supabaseAdmin
      .from("stories")
      .insert({
        user_id: user.id,
        device_id: user.id, // unused now but the column is NOT NULL
        title: story.title,
        description,
        pages: story.pages,
      })
      .select("id")
      .single();
    if (insertErr || !storyRow) {
      console.error("[/api/generate] story insert", insertErr);
      return NextResponse.json(
        { error: "Story generated but could not be saved." },
        { status: 500 },
      );
    }

    const { error: linkErr } = await supabaseAdmin
      .from("orders")
      .update({ story_id: storyRow.id })
      .eq("id", order.id);
    if (linkErr) console.error("[/api/generate] link order", linkErr);

    return NextResponse.json({ id: storyRow.id, story });
  } catch (err) {
    console.error("[/api/generate]", err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
