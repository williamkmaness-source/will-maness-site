"use client";

// HeadlineCard.tsx — editorial lede sentence showing the equity gap.
// Derives worst/best/gap client-side from the selected request type and metric so the
// lede stays in sync with the FilterBar metric toggle. Handles loading and error inline.

import { useMemo } from "react";
import { useTracker } from "./DataProvider";
import type { Metric } from "./DataProvider";
import { ALL_CATEGORIES, type NeighborhoodStat, type RequestTypeMetrics } from "./types";
import { filterNeighborhoods } from "./sampleFilter";

function formatMultiplier(n: number): string {
  return `${n.toFixed(1)}×`;
}

function formatDays(n: number): string {
  return n === 1 ? "1 day" : `${n.toFixed(1)} days`;
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type Headline = {
  worst: NeighborhoodStat;
  best: NeighborhoodStat;
  // For medianDays: ratio (worst / best). For onTimeRate: null — gap is shown as two percents.
  ratio: number | null;
  cityValue: number | null;
};

function buildHeadline(
  type: RequestTypeMetrics,
  metric: Metric
): Headline | null {
  const eligible = filterNeighborhoods(type.neighborhoods, type.totalCases);
  if (eligible.length < 2) return null;

  if (metric === "medianDays") {
    const sorted = [...eligible].sort((a, b) => b.medianDays - a.medianDays);
    const worst = sorted[0];
    const best = sorted[sorted.length - 1];
    const ratio = best.medianDays > 0 ? worst.medianDays / best.medianDays : null;
    return { worst, best, ratio, cityValue: type.cityMedian };
  }

  // onTimeRate: lower rate is worse.
  const sorted = [...eligible].sort((a, b) => a.onTimeRate - b.onTimeRate);
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  const totalCount = eligible.reduce((s, n) => s + n.count, 0);
  const cityValue =
    totalCount > 0
      ? eligible.reduce((s, n) => s + n.onTimeRate * n.count, 0) / totalCount
      : null;
  return { worst, best, ratio: null, cityValue };
}

export function HeadlineCard() {
  const { data, loading, error, retry, selectedRequestType, selectedMetric } =
    useTracker();

  const activeType = useMemo(() => {
    if (!data) return null;
    return (
      data.requestTypes.find((rt) => rt.requestType === selectedRequestType) ??
      data.featured ??
      null
    );
  }, [data, selectedRequestType]);

  const headline = useMemo(
    () => (activeType ? buildHeadline(activeType, selectedMetric) : null),
    [activeType, selectedMetric]
  );

  if (loading) {
    return (
      <div className="py-[64px]">
        <div className="h-[14px] w-[160px] bg-line rounded-[3px] mb-[28px] animate-pulse" />
        <div className="h-[44px] w-full max-w-[680px] bg-line rounded-[3px] mb-[12px] animate-pulse" />
        <div className="h-[44px] w-[75%] max-w-[510px] bg-line rounded-[3px] animate-pulse" />
      </div>
    );
  }

  if (error || !activeType) {
    return (
      <div className="py-[64px]">
        <p className="font-mono text-[12px] tracking-[0.06em] uppercase text-clay mb-[20px]">
          Boston 311 Equity Tracker
        </p>
        <p className="font-sans text-[17px] text-muted mb-[20px]">
          {error ?? "No data available for this period."}
        </p>
        {error && (
          <button
            onClick={retry}
            className="font-sans text-[13px] font-medium text-ink border border-line-strong rounded-[4px] px-[16px] py-[7px] hover:bg-bg-soft transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const isAll = activeType.requestType === ALL_CATEGORIES;
  const requestLabel = isAll ? "any 311 request" : activeType.requestType.toLowerCase();
  const cityLabel =
    selectedMetric === "medianDays" ? "City median" : "City on-time rate";

  // SLA-enriched lede: only when a specific type is selected, metric is median days,
  // and the API returned a slaTarget for this request type.
  const slaTarget = !isAll ? activeType.slaTarget : null;
  const showSlaLede =
    selectedMetric === "medianDays" &&
    headline !== null &&
    slaTarget !== null;

  function renderMedianDaysLede() {
    if (!headline) return null;

    if (showSlaLede && slaTarget !== null) {
      const worstDays = headline.worst.medianDays;
      const bestDays = headline.best.medianDays;
      const delta = worstDays - slaTarget;

      if (delta > 0) {
        return (
          <p className="font-serif text-[36px] max-[640px]:text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink max-w-[780px]">
            <span className="text-accent">{headline.worst.neighborhood}</span>
            {"'"}s median{" "}
            <span className="italic">{requestLabel}</span> response is{" "}
            <span className="text-clay">{formatDays(worstDays)}</span> —{" "}
            {formatDays(delta)} past the city{"'"}s {slaTarget}-day target.{" "}
            <span className="text-accent">{headline.best.neighborhood}</span>{" "}
            closes the same requests in {formatDays(bestDays)}.
          </p>
        );
      } else if (delta === 0) {
        return (
          <p className="font-serif text-[36px] max-[640px]:text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink max-w-[780px]">
            <span className="text-accent">{headline.worst.neighborhood}</span>
            {"'"}s median{" "}
            <span className="italic">{requestLabel}</span> response is{" "}
            <span className="text-clay">{formatDays(worstDays)}</span> — exactly
            at the city{"'"}s {slaTarget}-day target.{" "}
            <span className="text-accent">{headline.best.neighborhood}</span>{" "}
            closes the same requests in {formatDays(bestDays)}.
          </p>
        );
      } else {
        const underBy = Math.abs(delta);
        return (
          <p className="font-serif text-[36px] max-[640px]:text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink max-w-[780px]">
            <span className="text-accent">{headline.best.neighborhood}</span>{" "}
            closes{" "}
            <span className="italic">{requestLabel}</span> requests in{" "}
            <span className="text-clay">{formatDays(bestDays)}</span> —{" "}
            {formatDays(underBy)} under the city{"'"}s {slaTarget}-day target.
            The slowest neighborhood,{" "}
            <span className="text-accent">{headline.worst.neighborhood}</span>,
            takes {formatDays(worstDays)}.
          </p>
        );
      }
    }

    // Standard relative-comparison lede (All categories or no slaTarget)
    if (headline.ratio !== null) {
      return (
        <p className="font-serif text-[36px] max-[640px]:text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink max-w-[780px]">
          Residents in{" "}
          <span className="text-accent">{headline.worst.neighborhood}</span>{" "}
          wait{" "}
          <span className="text-clay">{formatMultiplier(headline.ratio)}</span>{" "}
          longer than residents in{" "}
          <span className="text-accent">{headline.best.neighborhood}</span>{" "}
          {isAll ? (
            <>for <span className="italic">{requestLabel}</span> to be resolved.</>
          ) : (
            <>for the same <span className="italic">{requestLabel}</span> request to be resolved.</>
          )}
        </p>
      );
    }

    return null;
  }

  return (
    <div className="py-[64px]">
      <p className="font-mono text-[12px] leading-[1.5] tracking-[0.06em] uppercase text-clay mb-[24px]">
        Boston 311 Equity Tracker
      </p>

      {headline ? (
        selectedMetric === "medianDays" ? (
          renderMedianDaysLede() ?? (
            <p className="font-serif text-[36px] max-[640px]:text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink max-w-[780px]">
              Not enough neighborhood data to compute an equity gap for{" "}
              <span className="italic">{requestLabel}</span> requests in this
              period.
            </p>
          )
        ) : selectedMetric === "onTimeRate" ? (
          <p className="font-serif text-[36px] max-[640px]:text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink max-w-[780px]">
            Boston resolves{" "}
            <span className="italic">{requestLabel}</span> requests on time{" "}
            <span className="text-clay">
              {formatPercent(headline.worst.onTimeRate)}
            </span>{" "}
            of the time in{" "}
            <span className="text-accent">{headline.worst.neighborhood}</span>,
            compared to{" "}
            <span className="text-accent">
              {formatPercent(headline.best.onTimeRate)}
            </span>{" "}
            in{" "}
            <span className="text-accent">{headline.best.neighborhood}</span>.
          </p>
        ) : (
          <p className="font-serif text-[36px] max-[640px]:text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink max-w-[780px]">
            Not enough neighborhood data to compute an equity gap for{" "}
            <span className="italic">{requestLabel}</span> requests in this
            period.
          </p>
        )
      ) : (
        <p className="font-serif text-[36px] max-[640px]:text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink max-w-[780px]">
          Not enough neighborhood data to compute an equity gap for{" "}
          <span className="italic">{requestLabel}</span> requests in this
          period.
        </p>
      )}

      {selectedMetric === "medianDays" &&
        activeType.equityGap !== null &&
        activeType.yoyEquityGap !== null && (
          <p className="font-serif text-[17px] leading-[1.5] text-muted mt-[16px] max-w-[680px]">
            {activeType.equityGap > activeType.yoyEquityGap * 1.05
              ? `The equity gap has widened year over year — from ${activeType.yoyEquityGap.toFixed(1)}× to ${activeType.equityGap.toFixed(1)}×.`
              : activeType.equityGap < activeType.yoyEquityGap * 0.95
              ? `The equity gap has narrowed year over year — from ${activeType.yoyEquityGap.toFixed(1)}× to ${activeType.equityGap.toFixed(1)}×.`
              : `The equity gap is largely unchanged year over year (${activeType.yoyEquityGap.toFixed(1)}× → ${activeType.equityGap.toFixed(1)}×).`}
          </p>
        )}

      <div className="mt-[28px] flex flex-wrap gap-x-[32px] gap-y-[8px] font-mono text-[12px] tracking-[0.04em] text-muted">
        {headline &&
          (selectedMetric === "medianDays" ? (
            <span>
              Slowest median: {formatDays(headline.worst.medianDays)} ·{" "}
              {headline.worst.neighborhood}
            </span>
          ) : (
            <span>
              Lowest on-time rate:{" "}
              {formatPercent(headline.worst.onTimeRate)} ·{" "}
              {headline.worst.neighborhood}
            </span>
          ))}
        {headline?.cityValue !== null && headline?.cityValue !== undefined && (
          <span>
            {cityLabel}:{" "}
            {selectedMetric === "medianDays"
              ? formatDays(headline.cityValue)
              : formatPercent(headline.cityValue)}
          </span>
        )}
        {data?.windowStart && data?.windowEnd && (
          <span>
            {formatDate(data.windowStart)} – {formatDate(data.windowEnd)}
          </span>
        )}
      </div>
    </div>
  );
}
