const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";

export async function generateNarration(text: string): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`[elevenlabs] ${res.status}: ${err.slice(0, 200)}`);
      return null;
    }

    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return `data:audio/mpeg;base64,${base64}`;
  } catch (err) {
    console.error("[elevenlabs] error:", err);
    return null;
  }
}
