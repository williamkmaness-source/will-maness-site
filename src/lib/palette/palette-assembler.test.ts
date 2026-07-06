import { describe, it, expect } from "vitest";
import { assemblePalette, buildPalettes } from "./palette-assembler";
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

describe("buildPalettes", () => {
  it("returns multiple distinct palettes for a real season", () => {
    const palettes = buildPalettes("#c81e5a", gamut);
    expect(palettes.length).toBeGreaterThan(1);
    const keys = palettes.map((p) => `${p.base}|${p.secondary}|${p.neutral}|${p.accent}`);
    expect(new Set(keys).size).toBe(palettes.length); // all distinct
  });

  it("leads with the complementary scheme", () => {
    expect(buildPalettes("#c81e5a", gamut)[0].scheme).toBe("complementary");
  });

  it("keeps every palette fully in-gamut", () => {
    for (const p of buildPalettes("#7fb0d0", gamut)) {
      for (const color of [p.base, p.secondary, p.neutral, p.accent]) {
        expect(gamut).toContain(color);
      }
    }
  });

  it("collapses near-identical palettes to one when the gamut forces the same colors", () => {
    // A single-color gamut forces every scheme to the same palette; de-dup → one result.
    const palettes = buildPalettes("#123456", ["#7fb0d0"]);
    expect(palettes).toHaveLength(1);
    expect(palettes[0].base).toBe("#7fb0d0");
  });
});
