import { describe, it, expect } from "vitest";
import { rotateHue, harmonyTargets } from "./harmony";
import { toOklchColor } from "./color-math";

// Circular hue difference in degrees, always in [0, 180].
function hueDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

describe("rotateHue", () => {
  it("rotates a chromatic anchor's hue by the given degrees", () => {
    const anchor = "#7791c6";
    const { h: h0 } = toOklchColor(anchor);
    const { h: h1 } = toOklchColor(rotateHue(anchor, 180));
    expect(hueDelta(h0, h1)).toBeCloseTo(180, 0);
  });

  it("roughly preserves lightness and chroma", () => {
    const anchor = "#7791c6";
    const before = toOklchColor(anchor);
    const after = toOklchColor(rotateHue(anchor, 120));
    expect(after.l).toBeCloseTo(before.l, 1);
    expect(after.c).toBeCloseTo(before.c, 1);
  });

  it("returns the anchor unchanged for achromatic colors (no meaningful hue)", () => {
    expect(rotateHue("#808080", 180)).toBe("#808080");
  });
});

describe("harmonyTargets", () => {
  const anchor = "#7791c6";

  it("returns one target for complementary, two for the others", () => {
    expect(harmonyTargets(anchor, "complementary")).toHaveLength(1);
    expect(harmonyTargets(anchor, "analogous")).toHaveLength(2);
    expect(harmonyTargets(anchor, "triadic")).toHaveLength(2);
    expect(harmonyTargets(anchor, "split-complementary")).toHaveLength(2);
  });

  it("places the complementary target opposite the anchor", () => {
    const { h: h0 } = toOklchColor(anchor);
    const [comp] = harmonyTargets(anchor, "complementary");
    expect(hueDelta(h0, toOklchColor(comp).h)).toBeCloseTo(180, 0);
  });

  it("places triadic targets ~120° from the anchor", () => {
    const { h: h0 } = toOklchColor(anchor);
    for (const t of harmonyTargets(anchor, "triadic")) {
      expect(hueDelta(h0, toOklchColor(t).h)).toBeCloseTo(120, 0);
    }
  });
});
