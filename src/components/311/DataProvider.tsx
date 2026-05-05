"use client";

// DataProvider.tsx — fetches /api/311-data on mount and exposes it via React Context.
// All 311 components read from this context — no prop drilling, no re-fetches on filter change.

import { createContext, useContext, useEffect, useState } from "react";
import type { TrackerData } from "./types";

export type Metric = "medianDays" | "onTimeRate";

type ContextValue = {
  data: TrackerData | null;
  loading: boolean;
  error: string | null;
  selectedRequestType: string | null;
  setSelectedRequestType: (type: string) => void;
  selectedMetric: Metric;
  setSelectedMetric: (metric: Metric) => void;
};

const TrackerContext = createContext<ContextValue>({
  data: null,
  loading: true,
  error: null,
  selectedRequestType: null,
  setSelectedRequestType: () => {},
  selectedMetric: "medianDays",
  setSelectedMetric: () => {},
});

export function useTracker() {
  return useContext(TrackerContext);
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequestType, setSelectedRequestType] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<Metric>("medianDays");

  useEffect(() => {
    fetch("/api/311-data")
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then((json: TrackerData) => {
        setData(json);
        // Initialize to featured type only on first load.
        setSelectedRequestType((prev) => prev ?? json.featured?.requestType ?? null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load data");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <TrackerContext.Provider
      value={{
        data,
        loading,
        error,
        selectedRequestType,
        setSelectedRequestType,
        selectedMetric,
        setSelectedMetric,
      }}
    >
      {children}
    </TrackerContext.Provider>
  );
}
