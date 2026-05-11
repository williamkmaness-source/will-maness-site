// sampleFilter.ts — neighborhood sample-size threshold shared across 311 chart components.
// Both NeighborhoodRanking and HeadlineCard apply this filter so the editorial lede
// never names a neighborhood the chart has already dropped for insufficient data.

import type { NeighborhoodStat } from "./types";

const SAMPLE_FRACTION = 0.03;
const MIN_COUNT_FLOOR = 5;

export function minCount(totalCases: number): number {
  return Math.max(MIN_COUNT_FLOOR, Math.round(SAMPLE_FRACTION * totalCases));
}

export function filterNeighborhoods(
  neighborhoods: NeighborhoodStat[],
  totalCases: number
): NeighborhoodStat[] {
  const threshold = minCount(totalCases);
  return neighborhoods.filter((n) => n.count >= threshold);
}
