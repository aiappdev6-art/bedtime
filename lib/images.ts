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
