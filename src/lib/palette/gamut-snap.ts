// gamut-snap.ts — pure "nearest in-season color" function. Given any input color and a
// season's color set, returns the closest member by perceptual distance. This is the
// constraint that guarantees nothing off-season is ever surfaced: every color the app
// shows passes through here first. Pure over (color, gamut) — no app state.

import { normalizeHex, perceptualDistance } from "./color-math";

/**
 * Return the color from `gamut` perceptually closest to `input`. The result is always a
 * member of `gamut`. If `input` is already in the gamut it returns itself.
 * Throws on an empty gamut (a season must have colors) or unparseable input.
 */
export function nearestInGamut(input: string, gamut: string[]): string {
  if (gamut.length === 0) {
    throw new Error("nearestInGamut: gamut is empty");
  }
  const hex = normalizeHex(input);
  if (hex === null) {
    throw new Error(`nearestInGamut: cannot parse color "${input}"`);
  }

  let best = gamut[0];
  let bestDistance = Infinity;
  for (const candidate of gamut) {
    const distance = perceptualDistance(hex, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}
