export async function generateImageWithPollinations(
  prompt: string,
  seed?: number,
): Promise<string> {
  const seedValue = seed ?? Math.floor(Math.random() * 1_000_000);
  const params = new URLSearchParams({
    width: process.env.POLLINATIONS_WIDTH || "768",
    height: process.env.POLLINATIONS_HEIGHT || "768",
    seed: String(seedValue),
  });
  if (process.env.POLLINATIONS_MODEL) {
    params.set("model", process.env.POLLINATIONS_MODEL);
  }
  if (process.env.POLLINATIONS_TOKEN) {
    params.set("nologo", "true");
    params.set("token", process.env.POLLINATIONS_TOKEN);
  }

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Pollinations ${res.status}`);
    const buf = await res.arrayBuffer();
    const mime = res.headers.get("content-type") || "image/jpeg";
    const base64 = Buffer.from(buf).toString("base64");
    return `data:${mime};base64,${base64}`;
  } finally {
    clearTimeout(timeout);
  }
}
