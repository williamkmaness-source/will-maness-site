"use client";

// FilterBar.tsx — request type dropdown and median-days / on-time-rate metric toggle.
// Reads and writes filter state from TrackerContext; no local state.

import { useTracker, MIN_NEIGHBORHOODS } from "./DataProvider";
import type { Metric } from "./DataProvider";

const METRIC_LABELS: Record<Metric, string> = {
  medianDays: "Median days to close",
  onTimeRate: "On-time rate",
};

export function FilterBar() {
  const {
    data,
    loading,
    selectedRequestType,
    setSelectedRequestType,
    selectedMetric,
    setSelectedMetric,
  } = useTracker();

  if (loading || !data) return null;

  // Only show types with enough neighborhood data to rank.
  const options = data.requestTypes.filter(
    (rt) => rt.neighborhoods.length >= MIN_NEIGHBORHOODS
  );

  return (
    <div className="flex flex-wrap gap-x-[32px] gap-y-[16px] items-end py-[24px] border-t border-line mb-[8px]">
      <div>
        <p className="font-mono text-[11px] tracking-[0.06em] uppercase text-hint mb-[8px]">
          Request type
        </p>
        <select
          value={selectedRequestType ?? ""}
          onChange={(e) => setSelectedRequestType(e.target.value)}
          className="font-sans text-[14px] text-ink bg-bg border border-line-strong rounded-[4px] px-[10px] py-[6px] cursor-pointer focus:outline-none focus:border-accent transition-colors"
        >
          {options.map((rt) => (
            <option key={rt.requestType} value={rt.requestType}>
              {rt.requestType}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="font-mono text-[11px] tracking-[0.06em] uppercase text-hint mb-[8px]">
          Metric
        </p>
        <div className="inline-flex border border-line-strong rounded-[4px] overflow-hidden">
          {(Object.keys(METRIC_LABELS) as Metric[]).map((metric) => (
            <button
              key={metric}
              onClick={() => setSelectedMetric(metric)}
              className={[
                "font-sans text-[13px] px-[12px] py-[6px] transition-colors",
                selectedMetric === metric
                  ? "bg-accent text-bg"
                  : "text-muted hover:text-ink hover:bg-bg-soft",
              ].join(" ")}
            >
              {METRIC_LABELS[metric]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
