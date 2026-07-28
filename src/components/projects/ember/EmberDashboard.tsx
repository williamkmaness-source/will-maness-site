"use client";

// EmberDashboard.tsx — client-side embed of the EmberBrief live dashboard (issue #164).
// Mirrors the StaffingDashboard pattern: fetches /api/ember-data on mount and renders
// the same pipeline status, county conditions, and cluster tree used by /ember/page.tsx.
// Keeps the project page (/work/ember) self-contained — no raw DB calls in the template.

import { useEffect, useState } from "react";
import type { EmberData } from "@/lib/ember/ember-queries";
import { CountyConditionsHeader } from "./CountyConditionsHeader";
import { ClusterCard } from "./ClusterCard";
import { PipelineStatus } from "./PipelineStatus";

function ZeroDetectionState({ redFlag }: { redFlag: boolean }) {
  return (
    <div
      className={[
        "py-[48px] px-[24px] text-center border rounded-sm",
        redFlag ? "border-clay bg-clay-soft" : "border-line bg-bg-soft",
      ].join(" ")}
    >
      {redFlag && (
        <div className="flex items-center justify-center gap-[8px] mb-[16px]">
          <span className="inline-block w-[7px] h-[7px] rounded-full bg-clay shrink-0" />
          <span className="font-mono text-[11px] tracking-[0.06em] uppercase text-clay font-medium">
            Fire weather conditions elevated — monitoring active
          </span>
        </div>
      )}
      <p className="font-serif text-[20px] text-muted mb-[10px]">
        No active detections in the Lake Tahoe Basin.
      </p>
      <p className="font-sans text-[14px] text-hint">
        {redFlag
          ? "Red Flag conditions are active. The pipeline is monitoring for new satellite detections."
          : "The pipeline runs daily. Current conditions are within normal range."}
      </p>
    </div>
  );
}

export function EmberDashboard() {
  const [data, setData] = useState<EmberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/ember-data", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then((json: EmberData) => {
        setData(json);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Log the raw failure for debugging; never surface it to visitors.
        console.error("[EmberDashboard] /api/ember-data failed:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="py-[64px] text-center">
        <p className="font-mono text-[13px] text-hint tracking-[0.04em] animate-pulse">
          Loading fire data…
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-[64px] text-center">
        <p className="font-mono text-[13px] text-clay tracking-[0.04em]">
          Could not load fire data. The pipeline may still be initializing.
        </p>
      </div>
    );
  }

  const { clusters, countyConditions } = data;

  return (
    <div className="my-[40px]">
      <PipelineStatus lastCheckedAt={countyConditions?.observedAt ?? null} />

      {countyConditions && <CountyConditionsHeader conditions={countyConditions} />}

      <div>
        <div className="flex items-baseline justify-between mb-[20px]">
          <h2 className="font-serif text-[22px] font-medium text-ink leading-[1.3]">
            Active detections
          </h2>
          {clusters.length > 0 && (
            <span className="font-mono text-[12px] text-hint">
              {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {clusters.length === 0 ? (
          <ZeroDetectionState redFlag={countyConditions?.redFlag ?? false} />
        ) : (
          <div className="flex flex-col gap-[12px]">
            {clusters.map((cluster) => (
              <ClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
