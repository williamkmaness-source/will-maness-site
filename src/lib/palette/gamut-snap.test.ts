import { describe, it, expect } from "vitest";
import { nearestInGamut } from "./gamut-snap";
import { LIGHT_SUMMER } from "./season-data";

// A tiny hand-picked gamut with obvious nearest neighbors, so the assertions are
// about behavior (which member is closest) rather than exact distance values.
const PRIMARIES = ["#ff0000", "#00ff00", "#0000ff"];

describe("nearestInGamut", () => {
  it("returns the color itself when it is already in the gamut", () => {
    expect(nearestInGamut("#00ff00", PRIMARIES)).toBe("#00ff00");
  });

  it("normalizes input before matching (shorthand in-gamut color)", () => {
    expect(nearestInGamut("#f00", PRIMARIES)).toBe("#ff0000");
  });

  it("snaps an off-gamut color to the known nearest member", () => {
    // A dark reddish color is nearest to red, not green or blue.
    expect(nearestInGamut("#990011", PRIMARIES)).toBe("#ff0000");
    // A teal leans blue over green/red here.
    expect(nearestInGamut("#0088aa", PRIMARIES)).toBe("#0000ff");
  });

  it("always returns a member of the gamut", () => {
    const result = nearestInGamut("#123456", LIGHT_SUMMER.colors);
    expect(LIGHT_SUMMER.colors).toContain(result);
  });

  it("throws on an empty gamut", () => {
    expect(() => nearestInGamut("#ffffff", [])).toThrow();
  });

  it("throws on unparseable input", () => {
    expect(() => nearestInGamut("not-a-color", PRIMARIES)).toThrow();
  });
});
