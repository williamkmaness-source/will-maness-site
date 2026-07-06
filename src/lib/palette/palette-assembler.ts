// palette-assembler.ts — turns a color + season into a four-role outfit palette, fully
// in-gamut. Roles: Base is the snapped anchor (the color the user identified); Secondary
// is the scheme's harmonious partner snapped into the season; Neutral is the season's
// lowest-chroma color (a grounding tone); Accent is the season color with the highest
// perceptual contrast from Base (the pop). Pure over (color, gamut, scheme).

import { toOklchColor, perceptualDistance } from "./color-math";
import { nearestInGamut } from "./gamut-snap";
import { harmonyTargets, type HarmonyScheme } from "./harmony";

export interface RolePalette {
  scheme: HarmonyScheme;
  base: string;
  secondary: string;
  neutral: string;
  accent: string;
}

/** The season color with the lowest OKLCH chroma — the most neutral, grounding tone. */
function lowestChroma(gamut: string[]): string {
  let best = gamut[0];
  let bestChroma = Infinity;
  for (const hex of gamut) {
    const { c } = toOklchColor(hex);
    if (c < bestChroma) {
      bestChroma = c;
      best = hex;
    }
  }
  return best;
}

/** The season color perceptually furthest from `from` — the highest-contrast pop. */
function highestContrastFrom(from: string, gamut: string[]): string {
  let best = gamut[0];
  let bestDistance = -Infinity;
  for (const hex of gamut) {
    const distance = perceptualDistance(from, hex);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = hex;
    }
  }
  return best;
}

/**
 * Assemble a four-role palette for `anchorHex` within `gamut` using one harmony scheme.
 * The anchor is snapped into the gamut first, so an off-season input still yields an
 * entirely in-season palette. Defaults to the complementary scheme (issue #222); the full
 * multi-scheme result set arrives in issue #224.
 */
export function assemblePalette(
  anchorHex: string,
  gamut: string[],
  scheme: HarmonyScheme = "complementary"
): RolePalette {
  const base = nearestInGamut(anchorHex, gamut);
  const [firstTarget] = harmonyTargets(base, scheme);
  const secondary = nearestInGamut(firstTarget, gamut);
  const neutral = lowestChroma(gamut);
  const accent = highestContrastFrom(base, gamut);
  return { scheme, base, secondary, neutral, accent };
}
