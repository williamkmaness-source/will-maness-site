// types.ts — shared types for the 311 Equity Tracker.
// Used by the API route, DataProvider, and all chart/card components.

export type NeighborhoodStat = {
  neighborhood: string;
  medianDays: number;
  onTimeRate: number;
  count: number;
};

export type RequestTypeMetrics = {
  requestType: string;
  equityGap: number | null;
  worstNeighborhood: string | null;
  worstMedianDays: number | null;
  bestNeighborhood: string | null;
  bestMedianDays: number | null;
  cityMedian: number | null;
  totalCases: number;
  neighborhoods: NeighborhoodStat[];
};

export type TrackerData = {
  lastUpdated: string;
  windowStart: string;
  windowEnd: string;
  featured: RequestTypeMetrics | null;
  requestTypes: RequestTypeMetrics[];
};
