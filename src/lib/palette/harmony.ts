// harmony.ts — pure color-theory harmony math. Given an in-gamut anchor, produce the
// ideal (pre-snap) target colors for a scheme by rotating hue in OKLCH while holding
// lightness and chroma. Callers snap these targets back into a season's gamut. All four
// schemes are implemented; the four-role card (issue #222) uses complementary, the
// multi-scheme results (issue #224) use the rest. No app state — pure and testable.

import { formatHex } from "culori";
import { toOklchColor } from "./color-math";

export type HarmonyScheme =
  | "complementary"
  | "analogous"
  | "triadic"
  | "split-complementary";

/**
 * Rotate an anchor color's hue by `degrees`, holding OKLCH lightness and chroma, and
 * return an sRGB-clamped hex. Achromatic anchors (chroma ~0) have no meaningful hue, so
 * rotation returns the anchor unchanged.
 */
export function rotateHue(anchorHex: string, degrees: number): string {
  const { l, c, h } = toOklchColor(anchorHex);
  if (c < 1e-4) return anchorHex;
  const rotated = { mode: "oklch" as const, l, c, h: (((h + degrees) % 360) + 360) % 360 };
  return formatHex(rotated);
}

/**
 * Ideal harmony target hexes for a scheme, excluding the anchor itself. These are
 * pre-snap references; the palette assembler resolves each to the nearest in-gamut color.
 */
export function harmonyTargets(anchorHex: string, scheme: HarmonyScheme): string[] {
  switch (scheme) {
    case "complementary":
      return [rotateHue(anchorHex, 180)];
    case "analogous":
      return [rotateHue(anchorHex, -30), rotateHue(anchorHex, 30)];
    case "triadic":
      return [rotateHue(anchorHex, 120), rotateHue(anchorHex, 240)];
    case "split-complementary":
      return [rotateHue(anchorHex, 150), rotateHue(anchorHex, 210)];
  }
}
