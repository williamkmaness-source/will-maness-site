"use client";

// FilterBar.tsx — request type dropdown plus a context-driven metric toggle.
// variant="backlog"  → shows Absolute / Net view toggle for the backlog chart.
// variant="ranking"  → shows Median days / On-time rate toggle for the ranking chart.

import { useState } from "react";
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
  const [announcement, setAnnouncement] = useState("");

  if (loading || !data) {
    return (
      <div className="flex flex-wrap gap-x-[32px] gap-y-[16px] items-end py-[24px] border-t border-line mb-[8px]">
        <div>
          <div className="h-[11px] w-[88px] bg-line rounded-[2px] mb-[8px] animate-pulse" />
          <div className="h-[34px] w-[200px] bg-line rounded-[4px] animate-pulse" />
        </div>
        <div>
          <div className="h-[11px] w-[48px] bg-line rounded-[2px] mb-[8px] animate-pulse" />
          <div className="h-[34px] w-[200px] bg-line rounded-[4px] animate-pulse" />
        </div>
      </div>
    );
  }

  const options = data.requestTypes.filter(
    (rt) => rt.neighborhoods.length >= MIN_NEIGHBORHOODS
  );

  // Separate "All categories" and group the rest by department.
  const allCategoriesOption = options.find(
    (rt) => rt.requestType === "All categories"
  );
  const specificOptions = options.filter(
    (rt) => rt.requestType !== "All categories"
  );

  // Build sorted groups: { department → sorted request types }
  const groupMap = new Map<string, typeof specificOptions>();
  for (const rt of specificOptions) {
    const dept = rt.department ?? "Other";
    if (!groupMap.has(dept)) groupMap.set(dept, []);
    groupMap.get(dept)!.push(rt);
  }
  const groups = Array.from(groupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dept, items]) => ({
      dept,
      items: [...items].sort((a, b) =>
        a.requestType.localeCompare(b.requestType)
      ),
    }));

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
          {allCategoriesOption && (
            <option value={allCategoriesOption.requestType}>
              {allCategoriesOption.requestType}
            </option>
          )}
          {groups.map(({ dept, items }) => (
            <optgroup key={dept} label={dept}>
              {items.map((rt) => (
                <option key={rt.requestType} value={rt.requestType}>
                  {rt.requestType}
                </option>
              ))}
            </optgroup>
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
                  aria-pressed={backlogView === view}
                  onClick={() => {
                    setBacklogView(view);
                    setAnnouncement(`View: ${BACKLOG_VIEW_LABELS[view]}`);
                  }}
                  className={[
                    "font-sans text-[13px] px-[12px] py-[6px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
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
                  aria-pressed={selectedMetric === metric}
                  onClick={() => {
                    setSelectedMetric(metric);
                    setAnnouncement(`Metric: ${METRIC_LABELS[metric]}`);
                  }}
                  className={[
                    "font-sans text-[13px] px-[12px] py-[6px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
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
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </span>
    </div>
  );
}
