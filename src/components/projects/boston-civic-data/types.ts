// types.ts — shared types for the 311 Equity Tracker.
// Used by the API route, DataProvider, and all chart/card components.

export type NeighborhoodStat = {
  neighborhood: string;
  medianDays: number;
  onTimeRate: number;
  count: number;
  openedCount: number;
  closedCount: number;
};

// Sentinel requestType value for the pooled-across-categories entry.
// Both the API response and the FilterBar treat this as the "All categories" option.
export const ALL_CATEGORIES = "All categories" as const;

export type RequestTypeMetrics = {
  requestType: string;
  department: string | null;
  slaTarget: number | null;
  equityGap: number | null;
  cityMedian: number | null;
  totalCases: number;
  neighborhoods: NeighborhoodStat[];
  yoyEquityGap: number | null;
};

export type TrackerData = {
  windowStart: string;
  windowEnd: string;
  featured: RequestTypeMetrics | null;
  requestTypes: RequestTypeMetrics[];
};
