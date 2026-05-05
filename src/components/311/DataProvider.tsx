"use client";

// DataProvider.tsx — fetches /api/311-data on mount and exposes it via React Context.
// All 311 components read from this context — no prop drilling, no re-fetches on filter change.

import { createContext, useContext, useEffect, useState } from "react";
import type { TrackerData } from "./types";

type ContextValue = {
  data: TrackerData | null;
  loading: boolean;
  error: string | null;
};

const TrackerContext = createContext<ContextValue>({
  data: null,
  loading: true,
  error: null,
});

export function useTracker() {
  return useContext(TrackerContext);
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/311-data")
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then((json: TrackerData) => {
        setData(json);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load data");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <TrackerContext.Provider value={{ data, loading, error }}>
      {children}
    </TrackerContext.Provider>
  );
}
