"use client";

// NeighborhoodRanking.tsx — horizontal bar chart ranking all neighborhoods by the selected metric.
// Color gradient runs from accent (best) to clay (worst).
// Reference line marks the city-wide value for the selected metric.

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { useTracker } from "./DataProvider";
import type { Metric } from "./DataProvider";
import { colors, fontFamilies } from "@/lib/tokens";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const ACCENT_RGB = hexToRgb(colors.accent);
const CLAY_RGB = hexToRgb(colors.clay);

// Linear interpolation between accent (t=0, best) and clay (t=1, worst).
function lerpColor(t: number): string {
  const r = Math.round(ACCENT_RGB[0] + t * (CLAY_RGB[0] - ACCENT_RGB[0]));
  const g = Math.round(ACCENT_RGB[1] + t * (CLAY_RGB[1] - ACCENT_RGB[1]));
  const b = Math.round(ACCENT_RGB[2] + t * (CLAY_RGB[2] - ACCENT_RGB[2]));
  return `rgb(${r},${g},${b})`;
}

// index 0 = worst (clay, t=1), last index = best (accent, t=0)
function barColor(index: number, total: number): string {
  const t = total <= 1 ? 0.5 : (total - 1 - index) / (total - 1);
  return lerpColor(t);
}

type Entry = { neighborhood: string; value: number };

type ChartTooltipProps = TooltipContentProps<number, string> & {
  metric: Metric;
};

function ChartTooltip({ active, payload, label, metric }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const raw = payload[0].value;
  if (typeof raw !== "number") return null;
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

  // Sort worst-first so worst neighborhoods appear at the top of the chart.
  const chartData = useMemo<Entry[]>(() => {
    if (!activeType) return [];
    const sorted = [...activeType.neighborhoods].sort((a, b) =>
      selectedMetric === "medianDays"
        ? b.medianDays - a.medianDays
        : a.onTimeRate - b.onTimeRate
    );
    return sorted.map((n) => ({
      neighborhood: n.neighborhood,
      value: selectedMetric === "medianDays" ? n.medianDays : n.onTimeRate,
    }));
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

  const chartHeight = Math.max(
    400,
    (activeType?.neighborhoods.length ?? 12) * 34
  );

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
      </p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 48, bottom: 4, left: 0 }}
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
              stroke={colors.hint}
              strokeDasharray="4 3"
              label={{
                value: referenceLabel,
                fontSize: 10,
                fontFamily: fontFamilies.mono,
                fill: colors.hint,
                position: "insideTopRight",
              }}
            />
          )}
          <Bar dataKey="value" radius={[0, 2, 2, 0]} maxBarSize={22}>
            {chartData.map((entry, i) => (
              <Cell
                key={entry.neighborhood}
                fill={barColor(i, chartData.length)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
