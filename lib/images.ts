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

export async function generateImage(
  scenePrompt: string,
  options: ImageOptions = {},
): Promise<string> {
  const fullPrompt = buildPrompt(scenePrompt, options.characterSheet);
  const ref = options.referenceImageDataUri ?? null;

  // When the user paid for a custom character, OpenRouter (Gemini) is the
  // only provider that can use the reference photo. Don't fall through to
  // pollinations/lumen on failure — those would produce a non-personalised
  // image, which violates what the user paid for. Use picsum placeholder
  // as the last resort so the page never throws.
  if (ref) {
    try {
      return await generateImageWithOpenRouter(fullPrompt, {
        referenceImageDataUri: ref,
      });
    } catch (err) {
      console.error("[image:openrouter:character] failed:", err);
      return fallbackImage(scenePrompt);
    }
  }

  const order: Provider[] = [PROVIDER, ...ALL.filter((p) => p !== PROVIDER)];

  for (const provider of order) {
    try {
      if (provider === "pollinations") {
        return await generateImageWithPollinations(fullPrompt, options.seed);
      } else if (provider === "openrouter") {
        return await generateImageWithOpenRouter(fullPrompt);
      } else {
        const url = await lumenGenerate(fullPrompt);
        if (!url.includes("picsum.photos")) return url;
      }
    } catch (err) {
      console.error(`[image:${provider}] failed:`, err);
    }
  }

  console.warn("[image] all providers failed, using placeholder");
  return fallbackImage(scenePrompt);
}
