// OpenRouter image generation (Gemini 2.5 Flash Image by default).
// Supports an optional reference image so the user's uploaded photo can be
// reused as the main character across all pages of the story.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const IMAGE_MODEL =
  process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-2.5-flash-image-preview";

type GenerateOptions = {
  /** Optional data: URI of a reference photo to use as the main character. */
  referenceImageDataUri?: string | null;
};

const BASE_INSTRUCTION =
  "Children's storybook illustration, soft warm colors, friendly cartoon style, no text, no words, no letters in the image.";

const REFERENCE_INSTRUCTION =
  "Use the person in the attached reference photo as the main character. " +
  "Preserve their face, hairstyle, and skin tone consistently. " +
  "Stylize them as a friendly children's storybook cartoon (not photorealistic). " +
  "Place them in this scene:";

type ChatPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export async function generateImageWithOpenRouter(
  prompt: string,
  options: GenerateOptions = {},
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const ref = options.referenceImageDataUri ?? null;

  // Build the message. When we have a reference image, send a mixed-content
  // array (text + image_url). Otherwise send a plain string (cheaper to parse
  // and matches the original behaviour).
  const userContent: string | ChatPart[] = ref
    ? [
        { type: "text", text: `${REFERENCE_INSTRUCTION} ${prompt}` },
        { type: "image_url", image_url: { url: ref } },
      ]
    : `${BASE_INSTRUCTION} Scene: ${prompt}`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      modalities: ["image", "text"],
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter image ${res.status}: ${text}`);
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message;
  const images = message?.images as
    | Array<{ image_url?: { url?: string }; type?: string }>
    | undefined;

  const url = images?.[0]?.image_url?.url;
  if (url) return url;

  // Some models return image as data URI in content.
  if (typeof message?.content === "string") {
    const match = message.content.match(
      /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/,
    );
    if (match) return match[0];
  }

  throw new Error("No image returned from OpenRouter");
}
