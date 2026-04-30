import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const LUMEN_URL = process.env.LUMEN_MCP_URL || "https://app.lumenpro.io/mcp";

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const token = process.env.LUMEN_TOKEN;
  if (!token) throw new Error("LUMEN_TOKEN not set");

  const transport = new StreamableHTTPClientTransport(new URL(LUMEN_URL), {
    requestInit: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const client = new Client({ name: "kids-story-app", version: "1.0.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    try {
      await client.close();
    } catch {}
  }
}

function fallbackImage(prompt: string): string {
  const seed = encodeURIComponent(prompt.slice(0, 60));
  return `https://picsum.photos/seed/${seed}/1024/1024`;
}

export async function generateImage(prompt: string): Promise<string> {
  try {
    return await withClient(async (client) => {
      const { tools } = await client.listTools();
      const tool =
        tools.find((t) => /image|illustrat|picture|draw/i.test(t.name)) ||
        tools.find((t) => /generate|create/i.test(t.name));

      if (!tool) {
        console.warn("[lumen] no image-like tool. tools:", tools.map((t) => t.name));
        return fallbackImage(prompt);
      }

      const argSchema = (tool.inputSchema as { properties?: Record<string, unknown> })?.properties || {};
      const argKey =
        Object.keys(argSchema).find((k) => /prompt|text|description/i.test(k)) ||
        "prompt";
      const args: Record<string, unknown> = { [argKey]: prompt };

      const result = await client.callTool({ name: tool.name, arguments: args });
      const content = (result.content || []) as Array<Record<string, unknown>>;

      for (const item of content) {
        if (item.type === "image" && item.data) {
          const mime = (item.mimeType as string) || "image/png";
          return `data:${mime};base64,${item.data}`;
        }
        if (item.type === "resource") {
          const resource = item.resource as { uri?: string } | undefined;
          if (resource?.uri) return resource.uri;
        }
        if (item.type === "text" && typeof item.text === "string") {
          const match = item.text.match(/https?:\/\/[^\s)"']+/);
          if (match) return match[0];
        }
      }
      console.warn("[lumen] no image in result:", JSON.stringify(content).slice(0, 300));
      return fallbackImage(prompt);
    });
  } catch (err) {
    console.error("[lumen] error:", err);
    return fallbackImage(prompt);
  }
}
