"use client";

// HeadlineCard.tsx — editorial lede sentence showing the Equity Gap Index.
// Renders the featured request type's worst/best neighborhood gap as a readable sentence,
// not a KPI card. Handles loading skeleton and error states inline.

import { useTracker } from "./DataProvider";

function formatMultiplier(n: number): string {
  return `${n.toFixed(1)}×`;
}

function formatDays(n: number): string {
  return n === 1 ? "1 day" : `${n.toFixed(1)} days`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function HeadlineCard() {
  const { data, loading, error, selectedRequestType } = useTracker();

  if (loading) {
    return (
      <div className="py-[64px]">
        <div className="h-[14px] w-[160px] bg-line rounded-[3px] mb-[28px] animate-pulse" />
        <div className="h-[44px] w-full max-w-[680px] bg-line rounded-[3px] mb-[12px] animate-pulse" />
        <div className="h-[44px] w-[75%] max-w-[510px] bg-line rounded-[3px] animate-pulse" />
      </div>
    );
  }

  const f =
    data?.requestTypes.find((rt) => rt.requestType === selectedRequestType) ??
    data?.featured ??
    null;

  if (error || !f) {
    return (
      <div className="py-[64px]">
        <p className="font-mono text-[12px] tracking-[0.06em] uppercase text-clay mb-[20px]">
          Boston 311 Equity Tracker
        </p>
        <p className="font-sans text-[17px] text-muted">
          {error ?? "No data available for this period."}
        </p>
      </div>
    );
  }

  const hasGap =
    f.equityGap !== null &&
    f.worstNeighborhood !== null &&
    f.bestNeighborhood !== null &&
    f.worstMedianDays !== null;

  return (
    <div className="py-[64px]">
      <p className="font-mono text-[12px] leading-[1.5] tracking-[0.06em] uppercase text-clay mb-[24px]">
        Boston 311 Equity Tracker
      </p>

      {hasGap ? (
        <p className="font-serif text-[36px] max-[640px]:text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink max-w-[780px]">
          Residents in{" "}
          <span className="text-accent">{f.worstNeighborhood}</span> wait{" "}
          <span className="text-clay">{formatMultiplier(f.equityGap!)}</span>{" "}
          longer than residents in{" "}
          <span className="text-accent">{f.bestNeighborhood}</span> for the
          same{" "}
          <span className="italic">{f.requestType.toLowerCase()}</span> request
          to be resolved.
        </p>
      ) : (
        <p className="font-serif text-[36px] max-[640px]:text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink max-w-[780px]">
          Not enough neighborhood data to compute an equity gap for{" "}
          <span className="italic">{f.requestType.toLowerCase()}</span> requests
          in this period.
        </p>
      )}

      <div className="mt-[28px] flex flex-wrap gap-x-[32px] gap-y-[8px] font-mono text-[12px] tracking-[0.04em] text-muted">
        {hasGap && f.worstMedianDays !== null && (
          <span>
            Slowest median: {formatDays(f.worstMedianDays)} ·{" "}
            {f.worstNeighborhood}
          </span>
        )}
        {f.cityMedian !== null && (
          <span>City median: {formatDays(f.cityMedian)}</span>
        )}
        <span>
          {data?.windowStart && data?.windowEnd
            ? `${formatDate(data.windowStart)} – ${formatDate(data.windowEnd)}`
            : null}
        </span>
      </div>
    </div>
  );
}
