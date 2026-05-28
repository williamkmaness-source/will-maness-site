// Tests for ember-scoring (issue #97).
// Covers tier boundaries, Red Flag override, trend computation, and null-safe paths.

import { describe, it, expect } from "vitest";
import {
  scoreFrpIntensity,
  scoreWeatherDanger,
  scoreTrend,
  computeRiskScore,
  assignTier,
  FRP_LOW_MW,
  FRP_HIGH_MW,
  WATCH_THRESHOLD,
  ACTION_THRESHOLD,
} from "./ember-scoring";

describe("scoreFrpIntensity", () => {
  it("returns 0 at or below the low threshold", () => {
    expect(scoreFrpIntensity(0)).toBe(0);
    expect(scoreFrpIntensity(FRP_LOW_MW)).toBe(0);
  });

  it("returns 100 at or above the high threshold", () => {
    expect(scoreFrpIntensity(FRP_HIGH_MW)).toBe(100);
    expect(scoreFrpIntensity(9999)).toBe(100);
  });

  it("returns a value between 0 and 100 for mid-range FRP", () => {
    const score = scoreFrpIntensity(255); // midpoint ≈ 50%
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });
});

describe("scoreWeatherDanger", () => {
  it("returns 100 when Red Flag is active regardless of wind and humidity", () => {
    expect(scoreWeatherDanger(0, 90, true)).toBe(100);
    expect(scoreWeatherDanger(null, null, true)).toBe(100);
  });

  it("returns 50 (neutral) when both inputs are null and no Red Flag", () => {
    expect(scoreWeatherDanger(null, null, false)).toBe(50);
  });

  it("scores higher for dry + windy conditions", () => {
    const highDanger = scoreWeatherDanger(40, 5, false);
    const lowDanger = scoreWeatherDanger(5, 80, false);
    expect(highDanger).toBeGreaterThan(lowDanger);
  });

  it("clamps humidity score to [0, 100]", () => {
    // 0% humidity → rhScore = 100
    expect(scoreWeatherDanger(null, 0, false)).toBe(75); // (100 + 50) / 2
  });

  it("uses 50 for null wind and real humidity", () => {
    // null wind → windScore = 50; RH = 0 → rhScore = 100
    expect(scoreWeatherDanger(null, 0, false)).toBe(75);
  });
});

describe("scoreTrend", () => {
  it("returns 50 when priorFrp is null (no history)", () => {
    expect(scoreTrend(200, null)).toBe(50);
  });

  it("returns 50 when FRP is unchanged", () => {
    expect(scoreTrend(100, 100)).toBe(50);
  });

  it("returns a value > 50 when FRP increased", () => {
    expect(scoreTrend(200, 100)).toBeGreaterThan(50);
  });

  it("returns a value < 50 when FRP decreased", () => {
    expect(scoreTrend(50, 100)).toBeLessThan(50);
  });

  it("clamps to 100 for very large FRP increase", () => {
    expect(scoreTrend(10000, 10)).toBe(100);
  });

  it("clamps to 0 for very large FRP decrease", () => {
    expect(scoreTrend(0, 10000)).toBe(0);
  });
});

describe("assignTier", () => {
  it("assigns Monitor for score < WATCH_THRESHOLD", () => {
    expect(assignTier(WATCH_THRESHOLD - 1)).toBe("Monitor");
    expect(assignTier(0)).toBe("Monitor");
    expect(assignTier(39)).toBe("Monitor");
  });

  it("assigns Watch at exactly WATCH_THRESHOLD", () => {
    expect(assignTier(WATCH_THRESHOLD)).toBe("Watch");
    expect(assignTier(40)).toBe("Watch");
  });

  it("assigns Watch for scores between WATCH and ACTION thresholds", () => {
    expect(assignTier(55)).toBe("Watch");
    expect(assignTier(69)).toBe("Watch");
    expect(assignTier(ACTION_THRESHOLD - 1)).toBe("Watch");
  });

  it("assigns Action at exactly ACTION_THRESHOLD", () => {
    expect(assignTier(ACTION_THRESHOLD)).toBe("Action");
    expect(assignTier(70)).toBe("Action");
  });

  it("assigns Action for score > ACTION_THRESHOLD", () => {
    expect(assignTier(85)).toBe("Action");
    expect(assignTier(100)).toBe("Action");
  });
});

describe("computeRiskScore", () => {
  it("uses neutral defaults when all optional inputs are null", () => {
    // frpScore(10) = 0, weatherScore(null, null, false) = 50, trendScore(10, null) = 50
    // 0.4*0 + 0.4*50 + 0.2*50 = 0 + 20 + 10 = 30
    expect(computeRiskScore(FRP_LOW_MW, null, null, false, null)).toBeCloseTo(30);
  });

  it("Red Flag pushes weather component to max", () => {
    // frpScore = 0, weatherScore = 100, trendScore = 50
    // 0.4*0 + 0.4*100 + 0.2*50 = 0 + 40 + 10 = 50
    expect(computeRiskScore(FRP_LOW_MW, null, null, true, null)).toBeCloseTo(50);
  });

  it("large fire with dry/windy weather and growing trend reaches Action tier", () => {
    // frpScore(500) = 100, weatherScore(50 mph, 0%, no flag) = 100, trendScore(500, 100) = 100
    const score = computeRiskScore(500, 50, 0, false, 100);
    expect(score).toBeCloseTo(100);
    expect(assignTier(score)).toBe("Action");
  });
});
