import { generateImage as lumenGenerate } from "./lumen";
import { generateImageWithOpenRouter } from "./openrouterImage";
import { generateImageWithPollinations } from "./pollinations";

type Provider = "pollinations" | "openrouter" | "lumen";

const PROVIDER = (process.env.IMAGE_PROVIDER || "pollinations") as Provider;

export type ImageOptions = {
  /** Character sheet — prepended to every prompt for consistency */
  characterSheet?: string;
  /** Stable seed per story so style/colors stay consistent across pages */
  seed?: number;
  /** Storage path of a user-uploaded reference photo (kept for diagnostics) */
  characterImagePath?: string | null;
  /**
   * Pre-loaded reference photo as a data: URI. When provided we force the
   * OpenRouter (Gemini) provider since it's the only one that accepts image
   * input. Computed once per story in /api/generate and reused for all pages.
   */
  referenceImageDataUri?: string | null;
};

function fallbackImage(prompt: string): string {
  const seed = encodeURIComponent(prompt.slice(0, 60));
  return `https://picsum.photos/seed/${seed}/1024/1024`;
}

const ALL: Provider[] = ["pollinations", "openrouter", "lumen"];

function buildPrompt(scenePrompt: string, characterSheet?: string): string {
  if (!characterSheet) return scenePrompt;
  return `${characterSheet}\n\nScene: ${scenePrompt}`;
}

export type ImageResult = {
  url: string;
  /** Which provider produced the image — useful to detect a personalisation miss. */
  provider: Provider | "picsum";
  /** True when the user's reference photo actually made it into the request. */
  usedReference: boolean;
};

export async function generateImage(
  scenePrompt: string,
  options: ImageOptions = {},
): Promise<ImageResult> {
  const fullPrompt = buildPrompt(scenePrompt, options.characterSheet);
  const ref = options.referenceImageDataUri ?? null;

  // Personalised attempt: only OpenRouter (Gemini) accepts a reference photo.
  if (ref) {
    try {
      const url = await generateImageWithOpenRouter(fullPrompt, {
        referenceImageDataUri: ref,
      });
      return { url, provider: "openrouter", usedReference: true };
    } catch (err) {
      console.error("[image:openrouter:character] failed:", err);
      // Don't return picsum here — a story-relevant image without the user's
      // face is strictly better than a random landscape. Caller is expected
      // to flag the story for partial refund when usedReference is false.
    }
  }

  const order: Provider[] = [PROVIDER, ...ALL.filter((p) => p !== PROVIDER)];

  for (const provider of order) {
    try {
      if (provider === "pollinations") {
        const url = await generateImageWithPollinations(fullPrompt, options.seed);
        return { url, provider, usedReference: false };
      } else if (provider === "openrouter") {
        const url = await generateImageWithOpenRouter(fullPrompt);
        return { url, provider, usedReference: false };
      } else {
        const url = await lumenGenerate(fullPrompt);
        if (!url.includes("picsum.photos")) {
          return { url, provider, usedReference: false };
        }
      }
    } catch (err) {
      console.error(`[image:${provider}] failed:`, err);
    }
  }

  console.warn("[image] all providers failed, using placeholder");
  return {
    url: fallbackImage(scenePrompt),
    provider: "picsum",
    usedReference: false,
  };
}
