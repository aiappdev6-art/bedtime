const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

export type GeneratedStory = {
  title: string;
  characterSheet: string;
  pages: { text: string; imagePrompt: string }[];
};

const SYSTEM_PROMPT = `You are a children's book author. Given a title and description, write a sweet, age-appropriate (ages 4-8) story split into EXACTLY 4 pages. Each page is 2-4 short sentences.

You must ALSO produce a "characterSheet": a single concise paragraph (2-4 sentences) that describes every recurring character's exact visual appearance — species, body shape, fur/skin/hair color, clothing, distinguishing features (e.g. "a small fox with bright orange fur, white belly, fluffy tail with a white tip, wearing a tiny red scarf"). Also describe the consistent art style ("soft watercolor children's storybook illustration, warm pastel colors, friendly cartoon style"). This sheet will be PREPENDED to every page's image prompt to keep characters and style consistent.

For each page, the imagePrompt should describe ONLY the scene/action for that page (NOT re-describe the characters' appearance — that's in the character sheet). Keep imagePrompts short and focused on action, setting, and emotion.

Respond with ONLY valid JSON in this exact shape, no prose, no markdown fences:
{
  "title": "string",
  "characterSheet": "string",
  "pages": [
    { "text": "page 1 text", "imagePrompt": "page 1 scene description" },
    { "text": "page 2 text", "imagePrompt": "page 2 scene description" },
    { "text": "page 3 text", "imagePrompt": "page 3 scene description" },
    { "text": "page 4 text", "imagePrompt": "page 4 scene description" }
  ]
}`;

export async function generateStoryText(
  title: string,
  description: string,
): Promise<GeneratedStory> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Title: ${title}\n\nDescription: ${description}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content from OpenRouter");

  const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const parsed = JSON.parse(cleaned) as GeneratedStory;

  if (!parsed.pages || parsed.pages.length !== 4) {
    throw new Error("Story did not return 4 pages");
  }
  if (!parsed.characterSheet) parsed.characterSheet = "";
  return parsed;
}
