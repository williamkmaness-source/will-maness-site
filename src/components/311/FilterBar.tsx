"use client";

// FilterBar.tsx — request type dropdown plus a context-driven metric toggle.
// variant="backlog"  → shows Absolute / Net view toggle for the backlog chart.
// variant="ranking"  → shows Median days / On-time rate toggle for the ranking chart.

import { useTracker, MIN_NEIGHBORHOODS } from "./DataProvider";
import type { Metric, BacklogView } from "./DataProvider";

const METRIC_LABELS: Record<Metric, string> = {
  medianDays: "Median days to close",
  onTimeRate: "On-time rate",
};

const BACKLOG_VIEW_LABELS: Record<BacklogView, string> = {
  absolute: "Absolute",
  net: "Net change",
};

type Props = { variant?: "backlog" | "ranking" };

export function FilterBar({ variant = "ranking" }: Props) {
  const {
    data,
    loading,
    selectedRequestType,
    setSelectedRequestType,
    selectedMetric,
    setSelectedMetric,
    backlogView,
    setBacklogView,
  } = useTracker();

  if (loading || !data) return null;

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
          {variant === "backlog" ? "View" : "Metric"}
        </p>
        <div className="inline-flex border border-line-strong rounded-[4px] overflow-hidden">
          {variant === "backlog"
            ? (Object.keys(BACKLOG_VIEW_LABELS) as BacklogView[]).map((view) => (
                <button
                  key={view}
                  onClick={() => setBacklogView(view)}
                  className={[
                    "font-sans text-[13px] px-[12px] py-[6px] transition-colors",
                    backlogView === view
                      ? "bg-accent text-bg"
                      : "text-muted hover:text-ink hover:bg-bg-soft",
                  ].join(" ")}
                >
                  {BACKLOG_VIEW_LABELS[view]}
                </button>
              ))
            : (Object.keys(METRIC_LABELS) as Metric[]).map((metric) => (
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
