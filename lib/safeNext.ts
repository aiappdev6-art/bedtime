// Reject anything that isn't a same-origin relative path.
// Blocks "https://evil.com", "//evil.com" (protocol-relative), and "javascript:..." etc.
export function safeNext(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.startsWith("/\\")) return fallback;
  return raw;
}
