"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ReferenceLine,
  YAxis,
} from "recharts";
import type { DepartmentResult } from "@/app/api/311-departments/route";

const STATUS_COLORS = {
  green: "var(--accent)",
  yellow: "var(--status-watch)",
  red: "var(--clay)",
} as const;

const STATUS_BG = {
  green: "var(--accent-soft)",
  yellow: "var(--status-watch-soft)",
  red: "var(--clay-soft)",
} as const;

function Badge({ status }: { status: "green" | "yellow" | "red" }) {
  const label =
    status === "green"
      ? "Normal"
      : status === "yellow"
        ? "Watch"
        : "Pressure";

  return (
    <span
      className="inline-flex items-center gap-[5px] px-[8px] py-[2px] rounded-sm font-mono text-[10px] tracking-[0.06em] uppercase font-medium"
      style={{ color: STATUS_COLORS[status], backgroundColor: STATUS_BG[status] }}
    >
      <span
        className="inline-block w-[6px] h-[6px] rounded-full"
        style={{ backgroundColor: STATUS_COLORS[status] }}
      />
      {label}
    </span>
  );
}

function BacklogSparkline({ dept }: { dept: DepartmentResult }) {
  const data = dept.weeks.map((w) => ({
    week: w.week,
    net: w.opened - w.closed,
  }));

  return (
    <div className="h-[40px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <ReferenceLine y={0} stroke="var(--line)" strokeWidth={1} />
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Bar
            dataKey="net"
            fill={STATUS_COLORS[dept.status]}
            radius={[1, 1, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClosureSparkline({ dept }: { dept: DepartmentResult }) {
  const data = dept.weeks.map((w) => ({
    week: w.week,
    days: w.medianDays,
  }));

  return (
    <div className="h-[40px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          <Line
            type="monotone"
            dataKey="days"
            stroke={STATUS_COLORS[dept.status]}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DepartmentCard({
  dept,
  isSelected = false,
  onClick,
}: {
  dept: DepartmentResult;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const latestWeek = dept.weeks[dept.weeks.length - 1];
  const latestNet = latestWeek ? latestWeek.opened - latestWeek.closed : 0;
  const latestMedian = latestWeek?.medianDays ?? 0;

  return (
    <div
      className={`border rounded-[6px] p-[16px] flex flex-col gap-[12px] transition-colors ${
        isSelected
          ? "border-accent bg-accent-soft cursor-pointer"
          : "border-line cursor-pointer hover:border-line-strong"
      }`}
      title={dept.tooltip || undefined}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-[8px]">
        <h3 className="font-sans text-[13px] font-medium text-ink leading-[1.3] min-w-0">
          {dept.department}
        </h3>
        <Badge status={dept.status} />
      </div>

      {/* Tooltip text for flagged departments */}
      {dept.tooltip && (
        <p className="font-mono text-[11px] text-hint leading-[1.5]">
          {dept.tooltip}
        </p>
      )}

      {/* Sparklines */}
      <div className="grid grid-cols-2 gap-[12px]">
        <div>
          <p className="font-mono text-[10px] text-hint tracking-[0.04em] uppercase mb-[4px]">
            Net backlog
          </p>
          <BacklogSparkline dept={dept} />
          <p className="font-mono text-[11px] text-muted mt-[2px]">
            {latestNet >= 0 ? "+" : ""}{latestNet}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-hint tracking-[0.04em] uppercase mb-[4px]">
            Median close
          </p>
          <ClosureSparkline dept={dept} />
          <p className="font-mono text-[11px] text-muted mt-[2px]">
            {latestMedian.toFixed(1)}d
          </p>
        </div>
      </div>
    </div>
  );
}
