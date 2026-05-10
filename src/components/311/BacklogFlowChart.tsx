"use client";

// BacklogFlowChart.tsx — diverging horizontal bars per neighborhood showing opened
// vs. closed cases over the 30-day window. Opened (clay) extends left as negative
// values; closed (accent) extends right. X-axis is symmetric so the imbalance reads
// honestly. Sorted by net delta (opened - closed) descending — most underwater at top.
// Shares filter state with NeighborhoodRanking via DataProvider.

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import { useTracker } from "./DataProvider";
import { ALL_CATEGORIES } from "./types";
import { colors, fontFamilies } from "@/lib/tokens";

// Short aliases for compound neighborhood names that wrap awkwardly at narrow widths.
const SHORT_LABELS: Record<string, string> = {
  "South Boston / South Boston Waterfront": "S. Boston / Waterfront",
  "Fenway / Kenmore / Audubon Circle / Longwood": "Fenway / Longwood",
  "Downtown / Financial District": "Downtown / Financial",
};

const MOBILE_BREAKPOINT = 480;

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

type Row = {
  neighborhood: string;
  displayLabel: string;
  openedCount: number;
  closedCount: number;
  // Negated opened count so the bar extends left of zero.
  openedNeg: number;
  netDelta: number;
};

export function BacklogFlowChart() {
  const { data, loading, selectedRequestType } = useTracker();
  const isMobile = useIsMobile();

  const activeType = useMemo(
    () =>
      data?.requestTypes.find((rt) => rt.requestType === selectedRequestType) ??
      null,
    [data, selectedRequestType]
  );

  // Total Boston neighborhoods present in the data — derived from the pooled
  // "All categories" entry so the footnote denominator stays accurate even if the
  // per-type view is missing a neighborhood entirely.
  const totalBostonNeighborhoods = useMemo(() => {
    const all = data?.requestTypes.find((rt) => rt.requestType === ALL_CATEGORIES);
    return all?.neighborhoods.length ?? 0;
  }, [data]);

  const { chartData, max, visibleCount } = useMemo(() => {
    if (!activeType) {
      return { chartData: [] as Row[], max: 0, visibleCount: 0 };
    }
    const visible = activeType.neighborhoods
      .filter((n) => n.openedCount > 0 || n.closedCount > 0)
      .map((n) => ({
        neighborhood: n.neighborhood,
        displayLabel: isMobile
          ? SHORT_LABELS[n.neighborhood] ?? n.neighborhood
          : n.neighborhood,
        openedCount: n.openedCount,
        closedCount: n.closedCount,
        openedNeg: -n.openedCount,
        netDelta: n.openedCount - n.closedCount,
      }))
      .sort((a, b) => b.netDelta - a.netDelta);
    const rawMax = visible.reduce(
      (m, r) => Math.max(m, r.openedCount, r.closedCount),
      0
    );
    // Pad the domain so end-of-bar labels have room outside the bar.
    // Mobile gets extra room so labels never collide with YAxis text on the left
    // or get clipped by the container on the right.
    const max = rawMax * (isMobile ? 1.22 : 1.12);
    return { chartData: visible, max, visibleCount: visible.length };
  }, [activeType, isMobile]);

  const chartHeight = Math.max(360, chartData.length * 30);

  if (loading) {
    return (
      <div className="pb-[56px]">
        <div className="h-[360px] bg-line rounded-[4px] animate-pulse" />
      </div>
    );
  }

  if (!activeType || chartData.length === 0) {
    return (
      <div className="pb-[56px]">
        <p className="font-mono text-[11px] tracking-[0.06em] uppercase text-hint mb-[20px]">
          Backlog change by neighborhood, last 30 days
        </p>
        <p className="font-sans text-[14px] text-muted">
          No opened or closed cases for this category in the last 30 days.
        </p>
      </div>
    );
  }

  const yAxisWidth = isMobile ? 104 : 148;
  const yAxisFontSize = isMobile ? 11 : 12;
  const labelFontSize = isMobile ? 10 : 11;
  const horizontalMargin = isMobile ? 32 : 56;

  return (
    <div className="pb-[56px]">
      <p className="font-mono text-[11px] tracking-[0.06em] uppercase text-hint mb-[20px]">
        Backlog change by neighborhood, last 30 days
      </p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: horizontalMargin, bottom: 4, left: horizontalMargin }}
          stackOffset="sign"
          barCategoryGap="22%"
        >
          <XAxis
            type="number"
            domain={[-max, max]}
            tickFormatter={(v: number) => Math.abs(v).toString()}
            tick={{
              fontSize: 11,
              fontFamily: fontFamilies.mono,
              fill: colors.hint,
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="displayLabel"
            width={yAxisWidth}
            tick={{
              fontSize: yAxisFontSize,
              fontFamily: fontFamilies.sans,
              fill: colors.muted,
            }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <ReferenceLine x={0} stroke={colors.lineStrong} strokeWidth={1} />
          <Bar dataKey="openedNeg" fill={colors.clay} stackId="flow" maxBarSize={18}>
            <LabelList
              dataKey="openedCount"
              content={(props) => {
                const { x, y, height, value } = props as {
                  x: number; y: number; height: number; value: number;
                };
                return (
                  <text
                    x={x - 6}
                    y={y + height / 2 + 4}
                    fontSize={labelFontSize}
                    fontFamily={fontFamilies.mono}
                    fill={colors.clay}
                    textAnchor="end"
                  >
                    {value}
                  </text>
                );
              }}
            />
          </Bar>
          <Bar dataKey="closedCount" fill={colors.accent} stackId="flow" maxBarSize={18}>
            <LabelList
              dataKey="closedCount"
              content={(props) => {
                const { x, y, width, height, value } = props as {
                  x: number; y: number; width: number; height: number; value: number;
                };
                return (
                  <text
                    x={x + width + 6}
                    y={y + height / 2 + 4}
                    fontSize={labelFontSize}
                    fontFamily={fontFamilies.mono}
                    fill={colors.accent}
                    textAnchor="start"
                  >
                    {value}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-[24px] gap-y-[6px] mt-[12px] font-mono text-[11px] text-hint">
        <span className="inline-flex items-center gap-[6px]">
          <span
            className="inline-block w-[10px] h-[10px] rounded-[2px]"
            style={{ background: colors.clay }}
          />
          Opened
        </span>
        <span className="inline-flex items-center gap-[6px]">
          <span
            className="inline-block w-[10px] h-[10px] rounded-[2px]"
            style={{ background: colors.accent }}
          />
          Closed
        </span>
        <span>
          Showing {visibleCount} of {totalBostonNeighborhoods || visibleCount}{" "}
          neighborhoods with activity in this category
        </span>
      </div>
    </div>
  );
}
