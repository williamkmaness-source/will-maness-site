"use client";

// BacklogHeadlineCard.tsx — editorial lede for the backlog flow story.
// Parallel to HeadlineCard but reads opened/closed counts from the active request type
// and reports how many neighborhoods grew their backlog over the 30-day window.

import { useMemo } from "react";
import { useTracker } from "./DataProvider";
import { ALL_CATEGORIES } from "./types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function BacklogHeadlineCard() {
  const { data, loading, error, selectedRequestType } = useTracker();

  const activeType = useMemo(() => {
    if (!data) return null;
    return (
      data.requestTypes.find((rt) => rt.requestType === selectedRequestType) ??
      data.featured ??
      null
    );
  }, [data, selectedRequestType]);

  const stats = useMemo(() => {
    if (!activeType) return null;
    const visible = activeType.neighborhoods.filter(
      (n) => n.openedCount > 0 || n.closedCount > 0
    );
    if (visible.length === 0) return null;
    const growing = visible.filter((n) => n.openedCount > n.closedCount).length;
    const opened = visible.reduce((s, n) => s + n.openedCount, 0);
    const closed = visible.reduce((s, n) => s + n.closedCount, 0);
    return { visible: visible.length, growing, opened, closed };
  }, [activeType]);

  if (loading) {
    return (
      <div className="py-[64px]">
        <div className="h-[14px] w-[180px] bg-line rounded-[3px] mb-[28px] animate-pulse" />
        <div className="h-[44px] w-full max-w-[680px] bg-line rounded-[3px] mb-[12px] animate-pulse" />
        <div className="h-[44px] w-[70%] max-w-[480px] bg-line rounded-[3px] animate-pulse" />
      </div>
    );
  }

  if (error || !activeType || !stats) {
    return (
      <div className="py-[64px]">
        <p className="font-mono text-[12px] tracking-[0.06em] uppercase text-clay mb-[20px]">
          Boston 311 Backlog Flow
        </p>
        <p className="font-sans text-[17px] text-muted">
          {error ?? "No opened or closed cases for this category in the last 30 days."}
        </p>
      </div>
    );
  }

  const isAll = activeType.requestType === ALL_CATEGORIES;
  const categoryPhrase = isAll
    ? "across all 311 requests"
    : `for ${activeType.requestType.toLowerCase()}`;
  const netDelta = stats.opened - stats.closed;
  const netDirection =
    netDelta > 0
      ? "net growth"
      : netDelta < 0
      ? "net decline"
      : "no net change";

  return (
    <div className="py-[64px]">
      <p className="font-mono text-[12px] leading-[1.5] tracking-[0.06em] uppercase text-clay mb-[24px]">
        Boston 311 Backlog Flow
      </p>

      <p className="font-serif text-[36px] max-[640px]:text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink max-w-[780px]">
        Boston&apos;s backlog grew in{" "}
        <span className="text-clay">{stats.growing}</span> of{" "}
        <span className="text-accent">{stats.visible}</span> neighborhoods over
        the last 30 days {categoryPhrase}.
      </p>

      <p className="font-serif text-[17px] leading-[1.5] text-muted mt-[16px] max-w-[680px]">
        {stats.opened.toLocaleString()} opened ·{" "}
        {stats.closed.toLocaleString()} closed ·{" "}
        <span className={netDelta > 0 ? "text-clay" : netDelta < 0 ? "text-accent" : ""}>
          {netDirection}
          {netDelta !== 0 && ` of ${Math.abs(netDelta).toLocaleString()}`}
        </span>{" "}
        across pooled neighborhoods.
      </p>

      <div className="mt-[28px] flex flex-wrap gap-x-[32px] gap-y-[8px] font-mono text-[12px] tracking-[0.04em] text-muted">
        <span>
          Tracked neighborhoods: {stats.visible}
        </span>
        {data?.windowStart && data?.windowEnd && (
          <span>
            {formatDate(data.windowStart)} – {formatDate(data.windowEnd)}
          </span>
        )}
      </div>
    </div>
  );
}
