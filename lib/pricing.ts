// Single source of truth for pricing. Imported by both client (form total)
// and server (order amount). Server MUST recompute and never trust the
// client-submitted total.
//
// Prices are NEXT_PUBLIC_* so they're available in the browser bundle.
// All amounts are in KWD with 3 decimal places (Kuwaiti dinar convention).

function readPrice(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const PRICES = {
  base: readPrice("NEXT_PUBLIC_PRICE_BASE_KWD", 5),
  voice: readPrice("NEXT_PUBLIC_PRICE_VOICE_KWD", 3),
  characterImage: readPrice("NEXT_PUBLIC_PRICE_CHARACTER_KWD", 3),
} as const;

export type StoryOptions = {
  voice: boolean;
  characterImage: boolean;
};

/** Round to 3 decimals (KWD subunit). */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Compute the total price in KWD for a given set of options. */
export function computeTotal(opts: StoryOptions): number {
  let total = PRICES.base;
  if (opts.voice) total += PRICES.voice;
  if (opts.characterImage) total += PRICES.characterImage;
  return round3(total);
}

/** Format a KWD amount with 3 decimal places. */
export function formatKwd(amount: number): string {
  return `${amount.toFixed(3)} KWD`;
}
