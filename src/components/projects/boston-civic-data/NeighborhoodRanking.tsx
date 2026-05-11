"use client";

// NeighborhoodRanking.tsx — horizontal bar chart ranking all neighborhoods by the selected metric.
// All bars use accent green; opacity encodes ticket volume (best = full, low-volume = faded).
// Reference line marks the city-wide value for the selected metric.

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  LabelList,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { useTracker } from "./DataProvider";
import type { Metric } from "./DataProvider";
import { filterNeighborhoods, minCount } from "./sampleFilter";
import { colors, fontFamilies } from "@/lib/tokens";

const MIN_OPACITY = 0.4;

type Entry = {
  neighborhood: string;
  value: number;
  count: number;
  opacity: number;
};

function formatBarValue(value: number, metric: Metric): string {
  return metric === "medianDays"
    ? value.toFixed(1)
    : `${(value * 100).toFixed(0)}%`;
}

type ChartTooltipProps = TooltipContentProps<number, string> & {
  metric: Metric;
};

function ChartTooltip({ active, payload, label, metric }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const raw = payload[0].value;
  if (typeof raw !== "number") return null;
  const count = (payload[0].payload as Entry).count;
  const formatted =
    metric === "medianDays"
      ? raw === 1
        ? "1 day"
        : `${raw.toFixed(1)} days`
      : `${(raw * 100).toFixed(0)}%`;
  return (
    <div
      style={{
        background: colors.bg,
        border: `0.5px solid ${colors.lineStrong}`,
        borderRadius: 4,
        padding: "8px 12px",
      }}
    >
      <p
        style={{
          fontFamily: fontFamilies.sans,
          fontSize: 13,
          fontWeight: 500,
          color: colors.ink,
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: fontFamilies.mono,
          fontSize: 11,
          color: colors.muted,
          margin: "3px 0 0",
        }}
      >
        {formatted}
      </p>
      <p
        style={{
          fontFamily: fontFamilies.mono,
          fontSize: 11,
          color: colors.hint,
          margin: "2px 0 0",
        }}
      >
        n = {count.toLocaleString()}
      </p>
    </div>
  );
}

export function NeighborhoodRanking() {
  const { data, loading, selectedRequestType, selectedMetric } = useTracker();

  const activeType = useMemo(
    () =>
      data?.requestTypes.find((rt) => rt.requestType === selectedRequestType) ??
      null,
    [data, selectedRequestType]
  );

  // Sort worst-first, filter low-volume neighborhoods, and compute per-bar opacity.
  const { chartData, threshold, excludedCount } = useMemo(() => {
    if (!activeType) return { chartData: [] as Entry[], threshold: 0, excludedCount: 0 };
    const threshold = minCount(activeType.totalCases);
    const filtered = filterNeighborhoods(activeType.neighborhoods, activeType.totalCases);
    const excludedCount = activeType.neighborhoods.length - filtered.length;
    const maxCount = filtered.reduce((m, n) => Math.max(m, n.count), 0);
    const sorted = [...filtered].sort((a, b) =>
      selectedMetric === "medianDays"
        ? b.medianDays - a.medianDays
        : a.onTimeRate - b.onTimeRate
    );
    const chartData = sorted.map((n) => ({
      neighborhood: n.neighborhood,
      value: selectedMetric === "medianDays" ? n.medianDays : n.onTimeRate,
      count: n.count,
      opacity: maxCount > 0 ? MIN_OPACITY + (1 - MIN_OPACITY) * Math.sqrt(n.count / maxCount) : 1,
    }));
    return { chartData, threshold, excludedCount };
  }, [activeType, selectedMetric]);

  // City-level reference value for the selected metric.
  const referenceValue = useMemo(() => {
    if (!activeType) return null;
    if (selectedMetric === "medianDays") return activeType.cityMedian;
    const totalWeighted = activeType.neighborhoods.reduce(
      (s, n) => s + n.onTimeRate * n.count,
      0
    );
    const totalCount = activeType.neighborhoods.reduce(
      (s, n) => s + n.count,
      0
    );
    return totalCount > 0 ? totalWeighted / totalCount : null;
  }, [activeType, selectedMetric]);

  const referenceLabel =
    selectedMetric === "medianDays" ? "City median" : "City avg";

  const tickFormatter =
    selectedMetric === "medianDays"
      ? (v: number) => `${v}d`
      : (v: number) => `${(v * 100).toFixed(0)}%`;

  const chartHeight = Math.max(400, chartData.length * 34);

  if (loading) {
    return (
      <div className="pb-[56px]">
        <div className="h-[400px] bg-line rounded-[4px] animate-pulse" />
      </div>
    );
  }

  if (!activeType || chartData.length === 0) {
    return (
      <div className="pb-[56px]">
        <p className="font-sans text-[14px] text-muted">
          No neighborhood data available for this request type.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-[56px]">
      <p className="font-mono text-[11px] tracking-[0.06em] uppercase text-hint mb-[20px]">
        Neighborhood ranking · {chartData.length} neighborhoods
        {excludedCount > 0 ? ` of ${chartData.length + excludedCount}` : ""}
      </p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 56, bottom: 4, left: 0 }}
        >
          <XAxis
            type="number"
            tickFormatter={tickFormatter}
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
          <Tooltip
            cursor={{ fill: colors.line, opacity: 0.6 }}
            content={(props) => (
              <ChartTooltip
                {...(props as TooltipContentProps<number, string>)}
                metric={selectedMetric}
              />
            )}
          />
          {referenceValue !== null && (
            <ReferenceLine
              x={referenceValue}
              stroke={colors.muted}
              strokeWidth={2}
              strokeDasharray="4 3"
              label={(props) => {
                const vb = (props as { viewBox?: { x?: number; y?: number; height?: number } }).viewBox ?? {};
                const x = (vb.x ?? 0) + 6;
                const y = (vb.y ?? 0) + (vb.height ?? 0) - 8;
                return (
                  <text
                    x={x}
                    y={y}
                    fontSize={11}
                    fontFamily={fontFamilies.mono}
                    fontWeight={500}
                    fill={colors.inkSoft}
                    textAnchor="start"
                  >
                    {referenceLabel}
                  </text>
                );
              }}
            />
          )}
          <Bar dataKey="value" radius={[0, 2, 2, 0]} maxBarSize={22}>
            {chartData.map((entry) => (
              <Cell
                key={entry.neighborhood}
                fill={colors.accent}
                fillOpacity={entry.opacity}
              />
            ))}
            <LabelList
              dataKey="value"
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
                    fill={colors.hint}
                  >
                    {formatBarValue(value, selectedMetric)}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="font-mono text-[11px] text-hint mt-[12px]">
        Bar opacity reflects ticket volume
        {excludedCount > 0
          ? ` · ${excludedCount} neighborhood${excludedCount !== 1 ? "s" : ""} with fewer than ${threshold} tickets excluded`
          : ""}
      </p>
    </div>
  );
}
