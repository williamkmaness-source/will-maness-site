"use client";

// NeighborhoodRanking.tsx — horizontal bar chart ranking all neighborhoods by the selected metric.
// Color gradient runs from clay (worst) at top to accent (best) at bottom.
// Reference line marks the city-wide average for the selected metric.

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
import { useTracker } from "./DataProvider";

// Linear interpolation between accent (#2D4A3E, t=0) and clay (#B85C38, t=1).
function lerpColor(t: number): string {
  const r = Math.round(0x2d + t * (0xb8 - 0x2d));
  const g = Math.round(0x4a + t * (0x5c - 0x4a));
  const b = Math.round(0x3e + t * (0x38 - 0x3e));
  return `rgb(${r},${g},${b})`;
}

// index 0 = worst (clay, t=1), last index = best (accent, t=0)
function barColor(index: number, total: number): string {
  const t = total <= 1 ? 0.5 : (total - 1 - index) / (total - 1);
  return lerpColor(t);
}

type Entry = { neighborhood: string; value: number };

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  metric: "medianDays" | "onTimeRate";
};

function CustomTooltip({ active, payload, label, metric }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const formatted =
    metric === "medianDays"
      ? val === 1
        ? "1 day"
        : `${val.toFixed(1)} days`
      : `${(val * 100).toFixed(0)}%`;
  return (
    <div
      style={{
        background: "var(--bg)",
        border: "0.5px solid var(--line-strong)",
        borderRadius: 4,
        padding: "8px 12px",
      }}
    >
      <p
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--ink)",
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "'SF Mono', Menlo, Consolas, monospace",
          fontSize: 11,
          color: "var(--muted)",
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
      value:
        selectedMetric === "medianDays" ? n.medianDays : n.onTimeRate,
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

  const tickFormatter =
    selectedMetric === "medianDays"
      ? (v: number) => `${v}d`
      : (v: number) => `${(v * 100).toFixed(0)}%`;

  const chartHeight = Math.max(400, (activeType?.neighborhoods.length ?? 12) * 34);

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
              fontFamily: "'SF Mono', Menlo, Consolas, monospace",
              fill: "#8A8478",
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
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              fill: "#6B665B",
            }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "#E5DFD3", opacity: 0.6 }}
            content={({ active, payload, label }) => (
              <CustomTooltip
                active={active}
                payload={payload as unknown as Array<{ value: number }> | undefined}
                label={typeof label === "string" ? label : undefined}
                metric={selectedMetric}
              />
            )}
          />
          {referenceValue !== null && (
            <ReferenceLine
              x={referenceValue}
              stroke="#8A8478"
              strokeDasharray="4 3"
              label={{
                value: "City avg",
                fontSize: 10,
                fontFamily: "'SF Mono', Menlo, Consolas, monospace",
                fill: "#8A8478",
                position: "insideTopRight",
              }}
            />
          )}
          <Bar dataKey="value" radius={[0, 2, 2, 0]} maxBarSize={22}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={barColor(i, chartData.length)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
