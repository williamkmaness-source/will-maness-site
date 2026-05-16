"use client";

// DataProvider.tsx — fetches /api/311-data on mount and exposes it via React Context.
// All 311 components read from this context — no prop drilling, no re-fetches on filter change.

import { createContext, useContext, useEffect, useState } from "react";
import { ALL_CATEGORIES, type RequestTypeMetrics, type TrackerData } from "./types";

export type Metric = "medianDays" | "onTimeRate";
export type BacklogView = "absolute" | "net";

// Minimum neighborhood count for a request type to be rankable. Shared across the
// initial-selection logic here and the FilterBar dropdown so they can't drift.
export const MIN_NEIGHBORHOODS = 3;

type ContextValue = {
  data: TrackerData | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
  selectedRequestType: string | null;
  setSelectedRequestType: (type: string) => void;
  selectedMetric: Metric;
  setSelectedMetric: (metric: Metric) => void;
  backlogView: BacklogView;
  setBacklogView: (view: BacklogView) => void;
};

const TrackerContext = createContext<ContextValue | null>(null);

export function useTracker(): ContextValue {
  const ctx = useContext(TrackerContext);
  if (!ctx) {
    throw new Error("useTracker must be used inside <DataProvider>");
  }
  return ctx;
}

function pickInitialType(data: TrackerData): RequestTypeMetrics | null {
  // Default to the pooled "All categories" view when available — that's the entry
  // both charts share and the one a first-time visitor sees.
  const all = data.requestTypes.find((rt) => rt.requestType === ALL_CATEGORIES);
  if (all && all.neighborhoods.length >= MIN_NEIGHBORHOODS) return all;
  if (data.featured && data.featured.neighborhoods.length >= MIN_NEIGHBORHOODS) {
    return data.featured;
  }
  return (
    data.requestTypes.find((rt) => rt.neighborhoods.length >= MIN_NEIGHBORHOODS) ??
    null
  );
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedRequestType, setSelectedRequestType] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<Metric>("medianDays");
  const [backlogView, setBacklogView] = useState<BacklogView>("absolute");

  function retry() {
    setData(null);
    setError(null);
    setLoading(true);
    setRetryCount((n) => n + 1);
  }

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/311-data", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then((json: TrackerData) => {
        setData(json);
        setSelectedRequestType(pickInitialType(json)?.requestType ?? null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
      });

    return () => controller.abort();
  }, [retryCount]);

  return (
    <TrackerContext.Provider
      value={{
        data,
        loading,
        error,
        retry,
        selectedRequestType,
        setSelectedRequestType,
        selectedMetric,
        setSelectedMetric,
        backlogView,
        setBacklogView,
      }}
    >
      {children}
    </TrackerContext.Provider>
  );
}
