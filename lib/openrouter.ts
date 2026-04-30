const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

export type GeneratedStory = {
  title: string;
  pages: { text: string; imagePrompt: string }[];
};

const SYSTEM_PROMPT = `You are a children's book author. Given a title and description, write a sweet, age-appropriate (ages 4-8) story split into EXACTLY 4 pages. Each page is 2-4 short sentences. For each page, also provide a vivid image prompt suitable for a children's book illustration (cute, warm colors, storybook style, no text in image).

Respond with ONLY valid JSON in this exact shape, no prose, no markdown fences:
{
  "title": "string",
  "pages": [
    { "text": "page 1 text", "imagePrompt": "page 1 illustration prompt" },
    { "text": "page 2 text", "imagePrompt": "page 2 illustration prompt" },
    { "text": "page 3 text", "imagePrompt": "page 3 illustration prompt" },
    { "text": "page 4 text", "imagePrompt": "page 4 illustration prompt" }
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
  return parsed;
}
