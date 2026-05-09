"use client";

// BacklogFlowChart.tsx — diverging horizontal bars per neighborhood showing opened
// vs. closed cases over the 30-day window. Opened (clay) extends left as negative
// values; closed (accent) extends right. X-axis is symmetric so the imbalance reads
// honestly. Sorted by net delta (opened - closed) descending — most underwater at top.
// Shares filter state with NeighborhoodRanking via DataProvider.

import { useMemo } from "react";
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

type Row = {
  neighborhood: string;
  openedCount: number;
  closedCount: number;
  // Negated opened count so the bar extends left of zero.
  openedNeg: number;
  netDelta: number;
};

export function BacklogFlowChart() {
  const { data, loading, selectedRequestType } = useTracker();

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

  const { chartData, max, visibleCount, growingCount } = useMemo(() => {
    if (!activeType) {
      return { chartData: [] as Row[], max: 0, visibleCount: 0, growingCount: 0 };
    }
    const visible = activeType.neighborhoods
      .filter((n) => n.openedCount > 0 || n.closedCount > 0)
      .map((n) => ({
        neighborhood: n.neighborhood,
        openedCount: n.openedCount,
        closedCount: n.closedCount,
        openedNeg: -n.openedCount,
        netDelta: n.openedCount - n.closedCount,
      }))
      .sort((a, b) => b.netDelta - a.netDelta);
    const max = visible.reduce(
      (m, r) => Math.max(m, r.openedCount, r.closedCount),
      0
    );
    const growingCount = visible.filter((r) => r.netDelta > 0).length;
    return { chartData: visible, max, visibleCount: visible.length, growingCount };
  }, [activeType]);

  const isAll = activeType?.requestType === ALL_CATEGORIES;
  const categoryPhrase = isAll
    ? "across all 311 requests"
    : `for ${activeType?.requestType.toLowerCase()}`;

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

  return (
    <div className="pb-[56px]">
      <p className="font-mono text-[11px] tracking-[0.06em] uppercase text-hint mb-[8px]">
        Backlog change by neighborhood, last 30 days
      </p>
      <p className="font-serif text-[15px] leading-[1.5] text-muted mb-[20px] max-w-[680px]">
        Backlog grew in {growingCount} of {visibleCount}{" "}
        {visibleCount === 1 ? "neighborhood" : "neighborhoods"} {categoryPhrase}.
      </p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 56, bottom: 4, left: 56 }}
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
            dataKey="neighborhood"
            width={148}
            tick={{
              fontSize: 12,
              fontFamily: fontFamilies.sans,
              fill: colors.muted,
            }}
            axisLine={false}
            tickLine={false}
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
                    fontSize={11}
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
                    fontSize={11}
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
