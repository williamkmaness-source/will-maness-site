import { describe, it, expect } from "vitest";
import { computeEquityGap } from "./route";
import type { NeighborhoodStat } from "@/components/projects/boston-civic-data/types";

function makeStat(
  neighborhood: string,
  medianDays: number
): NeighborhoodStat {
  return {
    neighborhood,
    medianDays,
    onTimeRate: 0.8,
    count: 10,
    openedCount: 10,
    closedCount: 10,
  };
}

describe("computeEquityGap", () => {
  it("returns worst/best ratio for normal input", () => {
    const stats = [makeStat("A", 20), makeStat("B", 5), makeStat("C", 10)];
    expect(computeEquityGap(stats)).toBe(4);
  });

  it("returns null for empty input", () => {
    expect(computeEquityGap([])).toBeNull();
  });

  it("returns null for single neighborhood", () => {
    expect(computeEquityGap([makeStat("A", 10)])).toBe(1);
  });

  it("filters out zero-median neighborhoods", () => {
    const stats = [makeStat("A", 0), makeStat("B", 10), makeStat("C", 5)];
    expect(computeEquityGap(stats)).toBe(2);
  });

  it("returns null when all medians are zero", () => {
    const stats = [makeStat("A", 0), makeStat("B", 0)];
    expect(computeEquityGap(stats)).toBeNull();
  });

  it("returns 1 when all non-zero medians are equal", () => {
    const stats = [makeStat("A", 7), makeStat("B", 7), makeStat("C", 7)];
    expect(computeEquityGap(stats)).toBe(1);
  });

  it("handles negative medianDays by filtering them out", () => {
    const stats = [makeStat("A", -1), makeStat("B", 10), makeStat("C", 5)];
    expect(computeEquityGap(stats)).toBe(2);
  });
});
