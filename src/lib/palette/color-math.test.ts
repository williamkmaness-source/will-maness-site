import { describe, it, expect } from "vitest";
import { normalizeHex, toOklchColor, perceptualDistance } from "./color-math";

describe("normalizeHex", () => {
  it("expands shorthand hex to 6 digits", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
  });

  it("canonicalizes case and passes through 6-digit hex", () => {
    expect(normalizeHex("#7791C6")).toBe("#7791c6");
  });

  it("accepts named CSS colors", () => {
    expect(normalizeHex("rebeccapurple")).toBe("#663399");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeHex("  #7791c6  ")).toBe("#7791c6");
  });

  it("returns null for unparseable input", () => {
    expect(normalizeHex("not-a-color")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("")).toBeNull();
  });
});

describe("toOklchColor", () => {
  it("returns lightness, chroma, and hue channels", () => {
    const { l, c, h } = toOklchColor("#7791c6");
    expect(l).toBeGreaterThan(0);
    expect(l).toBeLessThan(1);
    expect(c).toBeGreaterThan(0);
    expect(h).toBeGreaterThanOrEqual(0);
  });

  it("reports zero hue for achromatic colors rather than undefined", () => {
    expect(toOklchColor("#808080").h).toBe(0);
  });
});

describe("perceptualDistance", () => {
  it("is zero for identical colors", () => {
    expect(perceptualDistance("#7791c6", "#7791c6")).toBe(0);
  });

  it("is symmetric", () => {
    const ab = perceptualDistance("#000000", "#ffffff");
    const ba = perceptualDistance("#ffffff", "#000000");
    expect(ab).toBeCloseTo(ba, 10);
  });

  it("grows monotonically with visible difference", () => {
    const near = perceptualDistance("#000000", "#050505");
    const far = perceptualDistance("#000000", "#ffffff");
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(far);
  });
});
