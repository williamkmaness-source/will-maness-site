// Tests for the music-analyzer popularity scorer (issue #215).
// Pure functions only — no network, no DB, no mocking.

import { describe, it, expect } from "vitest";
import { rateFeature, scoreFeatures, FEATURE_NAMES } from "./popularity-scorer";
import type { ExtractedFeatures } from "./feature-extractor";

function track(overrides: Partial<ExtractedFeatures> = {}): ExtractedFeatures {
  return {
    key_mode: "C Major",
    bpm_range: "120-139",
    song_structure: "standard",
    chord_flavor: "single-key",
    ...overrides,
  };
}

describe("rateFeature", () => {
  it("rates a feature in 25% or more of the pool as hot", () => {
    expect(rateFeature(25, 100)).toBe("hot");
    expect(rateFeature(60, 100)).toBe("hot");
    expect(rateFeature(100, 100)).toBe("hot");
  });

  it("rates 10–24% as trending", () => {
    expect(rateFeature(10, 100)).toBe("trending");
    expect(rateFeature(24, 100)).toBe("trending");
  });

  it("rates 4–9% as emerging", () => {
    expect(rateFeature(4, 100)).toBe("emerging");
    expect(rateFeature(9, 100)).toBe("emerging");
  });

  it("rates 1–3% as indie", () => {
    expect(rateFeature(1, 100)).toBe("indie");
    expect(rateFeature(3, 100)).toBe("indie");
  });

  it("is exact at every threshold boundary", () => {
    const cases: [number, string][] = [
      [3, "indie"],
      [4, "emerging"],
      [9, "emerging"],
      [10, "trending"],
      [24, "trending"],
      [25, "hot"],
    ];
    for (const [count, expected] of cases) {
      expect(rateFeature(count, 100)).toBe(expected);
    }
  });

  it("rates by share, not raw count, when the pool is smaller than 100", () => {
    // 5 of 20 tracks is 25% — hot, even though the raw count is only 5.
    expect(rateFeature(5, 20)).toBe("hot");
    expect(rateFeature(2, 20)).toBe("trending");
    expect(rateFeature(1, 20)).toBe("emerging");
  });

  it("degrades to indie rather than dividing by zero on an empty pool", () => {
    expect(rateFeature(0, 0)).toBe("indie");
    expect(rateFeature(5, 0)).toBe("indie");
  });

  it("treats a zero count as indie", () => {
    expect(rateFeature(0, 100)).toBe("indie");
  });
});

describe("scoreFeatures", () => {
  it("returns an empty result for an empty pool", () => {
    expect(scoreFeatures([])).toEqual([]);
  });

  it("counts every distinct value of every feature", () => {
    const pool = [
      track({ key_mode: "C Major" }),
      track({ key_mode: "C Major" }),
      track({ key_mode: "A Minor" }),
    ];

    const keyModes = scoreFeatures(pool).filter((s) => s.feature_name === "key_mode");
    expect(keyModes).toEqual([
      { feature_name: "key_mode", feature_value: "C Major", count: 2, rating: "hot" },
      { feature_name: "key_mode", feature_value: "A Minor", count: 1, rating: "hot" },
    ]);
  });

  it("scores all four feature dimensions", () => {
    const scored = scoreFeatures([track()]);
    expect(scored.map((s) => s.feature_name)).toEqual([...FEATURE_NAMES]);
    expect(scored.map((s) => s.feature_value)).toEqual([
      "C Major",
      "120-139",
      "standard",
      "single-key",
    ]);
  });

  it("assigns ratings from the value's share of the pool", () => {
    // 100 tracks: 30 hot, 15 trending, 5 emerging, 50 filler.
    const pool = [
      ...Array.from({ length: 30 }, () => track({ key_mode: "hot-key" })),
      ...Array.from({ length: 15 }, () => track({ key_mode: "trending-key" })),
      ...Array.from({ length: 5 }, () => track({ key_mode: "emerging-key" })),
      ...Array.from({ length: 2 }, () => track({ key_mode: "indie-key" })),
      ...Array.from({ length: 48 }, (_, i) => track({ key_mode: `filler-${i}` })),
    ];
    expect(pool).toHaveLength(100);

    const byValue = new Map(
      scoreFeatures(pool)
        .filter((s) => s.feature_name === "key_mode")
        .map((s) => [s.feature_value, s])
    );

    expect(byValue.get("hot-key")).toMatchObject({ count: 30, rating: "hot" });
    expect(byValue.get("trending-key")).toMatchObject({ count: 15, rating: "trending" });
    expect(byValue.get("emerging-key")).toMatchObject({ count: 5, rating: "emerging" });
    expect(byValue.get("indie-key")).toMatchObject({ count: 2, rating: "indie" });
  });

  it("orders values by descending count within a feature", () => {
    const pool = [
      ...Array.from({ length: 2 }, () => track({ bpm_range: "80-99" })),
      ...Array.from({ length: 5 }, () => track({ bpm_range: "120-139" })),
      ...Array.from({ length: 3 }, () => track({ bpm_range: "100-119" })),
    ];

    const counts = scoreFeatures(pool)
      .filter((s) => s.feature_name === "bpm_range")
      .map((s) => s.count);

    expect(counts).toEqual([5, 3, 2]);
  });

  it("groups all of one feature's values before the next feature's", () => {
    const pool = [track({ key_mode: "C Major" }), track({ key_mode: "A Minor" })];
    const names = scoreFeatures(pool).map((s) => s.feature_name);
    // key_mode has 2 values, the other three have 1 each.
    expect(names).toEqual([
      "key_mode",
      "key_mode",
      "bpm_range",
      "song_structure",
      "chord_flavor",
    ]);
  });

  it("ignores blank feature values so a failed extraction is not its own bucket", () => {
    const pool = [
      track({ key_mode: "C Major" }),
      track({ key_mode: "" }),
      track({ key_mode: null as unknown as string }),
    ];

    const keyModes = scoreFeatures(pool).filter((s) => s.feature_name === "key_mode");
    // One bucket only — the blank and null values are dropped, not counted as an "" value.
    expect(keyModes).toEqual([
      { feature_name: "key_mode", feature_value: "C Major", count: 1, rating: "hot" },
    ]);
  });

  it("counts every track's share against the full pool, blanks included", () => {
    // 1 of 3 tracks = 33% → hot, even though the other two had no key_mode.
    const pool = [track({ key_mode: "C Major" }), track({ key_mode: "" }), track({ key_mode: "" })];
    const keyMode = scoreFeatures(pool).find((s) => s.feature_name === "key_mode");
    expect(keyMode).toMatchObject({ count: 1, rating: "hot" });
  });
});
