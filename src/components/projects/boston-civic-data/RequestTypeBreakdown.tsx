"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { DepartmentBreakdownPayload } from "@/app/api/311-department-breakdown/route";

const OPENED_COLOR = "var(--accent)";
const CLOSED_COLOR = "var(--line-strong)";

function truncate(label: string, max = 32): string {
  return label.length > max ? label.slice(0, max - 1) + "…" : label;
}

export function RequestTypeBreakdown({ department }: { department: string }) {
  const [data, setData] = useState<DepartmentBreakdownPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const encoded = encodeURIComponent(department);

    fetch(`/api/311-department-breakdown?department=${encoded}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then((json: DepartmentBreakdownPayload) => {
        setData(json);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
      });

    return () => controller.abort();
  }, [department]);

  return (
    <section className="mt-[32px] mb-[8px] p-[20px] border border-line rounded-[6px]">
      <h3 className="font-serif text-[16px] font-medium text-ink leading-[1.3] mb-[16px]">
        Request Type Breakdown — {department} · Last 2 Weeks
      </h3>

      {loading && (
        <div className="h-[200px] flex items-center justify-center">
          <p className="font-mono text-[12px] text-hint tracking-[0.04em] animate-pulse">
            Loading breakdown…
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="h-[200px] flex items-center justify-center">
          <p className="font-mono text-[12px] text-clay tracking-[0.04em]">
            {error}
          </p>
        </div>
      )}

      {!loading && !error && data && data.reasons.length === 0 && (
        <div className="h-[200px] flex items-center justify-center">
          <p className="font-mono text-[12px] text-hint tracking-[0.04em]">
            No data available for this department.
          </p>
        </div>
      )}

      {!loading && !error && data && data.reasons.length > 0 && (
        <>
          <div style={{ height: Math.max(220, data.reasons.length * 28) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data.reasons.map((r) => ({
                  reason: truncate(r.reason),
                  Opened: r.opened,
                  Closed: r.closed,
                }))}
                margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--hint)" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="reason"
                  tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--hint)" }}
                  width={160}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg)",
                    border: "1px solid var(--line)",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--ink)",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", fontFamily: "var(--font-mono)" }}
                />
                <Bar dataKey="Opened" fill={OPENED_COLOR} isAnimationActive={false} radius={[0, 2, 2, 0]} />
                <Bar dataKey="Closed" fill={CLOSED_COLOR} isAnimationActive={false} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}
