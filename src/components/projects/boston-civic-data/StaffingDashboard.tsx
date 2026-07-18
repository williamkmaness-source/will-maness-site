"use client";

import { useEffect, useState } from "react";
import type {
  DepartmentsPayload,
  DepartmentResult,
} from "@/app/api/311-departments/route";
import { DepartmentCard } from "./DepartmentCard";
import { RequestTypeBreakdown } from "./RequestTypeBreakdown";

function Headline({
  flagged,
  total,
}: {
  flagged: number;
  total: number;
}) {
  return (
    <div className="mb-[32px]">
      <p className="font-serif text-[28px] font-medium leading-[1.25] text-ink">
        {flagged === 0
          ? `All ${total} departments operating normally.`
          : `${flagged} of ${total} department${total === 1 ? "" : "s"} showing operational pressure.`}
      </p>
    </div>
  );
}

function DataFooter({ lastUpdated }: { lastUpdated: string | null }) {
  const formatted = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <footer className="mt-[40px] pt-[20px] border-t border-line font-mono text-[11px] tracking-[0.04em] text-hint">
      <p>
        {formatted && <>Data last updated {formatted} · </>}
        <a
          href="https://data.boston.gov/dataset/311-service-requests"
          className="underline underline-offset-2 hover:text-muted transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Analyze Boston
        </a>{" "}
        · City of Boston · Public Domain (PDDL 1.0)
      </p>
    </footer>
  );
}

export function StaffingDashboard() {
  const [data, setData] = useState<DepartmentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/311-departments", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then((json: DepartmentsPayload) => {
        setData(json);
        setSelectedDepartment(json.departments[0]?.department ?? null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Log the raw failure for debugging; never surface it to visitors.
        console.error("[StaffingDashboard] /api/311-departments failed:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="py-[64px] text-center">
        <p className="font-mono text-[13px] text-hint tracking-[0.04em] animate-pulse">
          Loading department data…
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-[64px] text-center">
        <p className="font-mono text-[13px] text-clay tracking-[0.04em]">
          {error
            ? "Live data temporarily unavailable — check back shortly."
            : "No data available."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <Headline flagged={data.flaggedCount} total={data.totalCount} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[16px]">
        {data.departments.map((dept: DepartmentResult) => (
          <DepartmentCard
            key={dept.department}
            dept={dept}
            isSelected={dept.department === selectedDepartment}
            onClick={() => setSelectedDepartment(dept.department)}
          />
        ))}
      </div>
      {selectedDepartment && (
        <RequestTypeBreakdown department={selectedDepartment} />
      )}
      <DataFooter lastUpdated={data.lastUpdated} />
    </div>
  );
}
