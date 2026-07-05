// color-math.ts — the deep, pure color primitive every other palette module builds on.
// Wraps culori so the rest of the app speaks in plain hex strings: parse/normalize
// user input, convert to OKLCH, and measure perceptual distance (CIEDE2000). Kept
// dependency-thin and free of any React or app state so it is trivially unit-testable.

import { converter, parse, formatHex, differenceCiede2000 } from "culori";

const toOklch = converter("oklch");
const ciede2000 = differenceCiede2000();

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/**
 * Parse and canonicalize any CSS-parseable color into a 6-digit hex string
 * (e.g. "#abc" → "#aabbcc", "rebeccapurple" → "#663399"). Returns null for input
 * culori cannot parse, so callers can surface a clean validation error.
 */
export function normalizeHex(input: string): string | null {
  const parsed = parse(input.trim());
  if (!parsed) return null;
  return formatHex(parsed);
}

/** Convert a hex string to OKLCH. Hue is undefined for achromatic colors; we return 0. */
export function toOklchColor(hex: string): Oklch {
  const result = toOklch(hex);
  if (!result) {
    throw new Error(`toOklchColor: cannot parse color "${hex}"`);
  }
  return { l: result.l ?? 0, c: result.c ?? 0, h: result.h ?? 0 };
}

/**
 * Perceptual distance between two colors (CIEDE2000). Identical colors return 0;
 * larger values mean more visibly different. Symmetric and monotonic enough to drive
 * nearest-color snapping.
 */
export function perceptualDistance(a: string, b: string): number {
  return ciede2000(a, b);
}
