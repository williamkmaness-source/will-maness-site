import { describe, it, expect } from "vitest";
import { assemblePalette } from "./palette-assembler";
import { toOklchColor, perceptualDistance } from "./color-math";
import { nearestInGamut } from "./gamut-snap";
import { LIGHT_SUMMER } from "./season-data";

const gamut = LIGHT_SUMMER.colors;

function chromaOf(hex: string): number {
  return toOklchColor(hex).c;
}

describe("assemblePalette", () => {
  it("uses the snapped anchor as Base", () => {
    const anchor = "#c81e5a"; // off-season saturated input
    const palette = assemblePalette(anchor, gamut);
    expect(palette.base).toBe(nearestInGamut(anchor, gamut));
  });

  it("returns four roles that are all members of the season gamut", () => {
    const { base, secondary, neutral, accent } = assemblePalette("#7fb0d0", gamut);
    for (const color of [base, secondary, neutral, accent]) {
      expect(gamut).toContain(color);
    }
  });

  it("picks the lowest-chroma season color as Neutral", () => {
    const palette = assemblePalette("#7fb0d0", gamut);
    const minChroma = Math.min(...gamut.map(chromaOf));
    expect(chromaOf(palette.neutral)).toBeCloseTo(minChroma, 10);
  });

  it("picks the highest-contrast-from-Base season color as Accent", () => {
    const palette = assemblePalette("#7fb0d0", gamut);
    const maxDistance = Math.max(
      ...gamut.map((c) => perceptualDistance(palette.base, c))
    );
    expect(perceptualDistance(palette.base, palette.accent)).toBeCloseTo(maxDistance, 10);
  });

  it("records the scheme used", () => {
    expect(assemblePalette("#7fb0d0", gamut).scheme).toBe("complementary");
    expect(assemblePalette("#7fb0d0", gamut, "triadic").scheme).toBe("triadic");
  });

  it("is deterministic for the same inputs", () => {
    expect(assemblePalette("#c81e5a", gamut)).toEqual(assemblePalette("#c81e5a", gamut));
  });
});
