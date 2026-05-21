// app/ember/page.tsx — EmberBrief fire monitoring dashboard (issue #93).
// Server component. Reads directly from the DB using the shared ember-queries lib.
// Renders county conditions and cluster cards. Revalidates every 10 minutes
// to stay in sync with the cron cadence.

import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { getEmberData, getSqlClient } from "@/lib/ember/ember-queries";
import { CountyConditionsHeader } from "@/components/projects/ember/CountyConditionsHeader";
import { ClusterCard } from "@/components/projects/ember/ClusterCard";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "EmberBrief — Shasta County Fire Dashboard | Will Maness",
  description:
    "Live satellite fire detection for Shasta County — clusters, risk scores, and current weather conditions updated every 10 minutes.",
};

export default async function EmberPage() {
  let data;
  try {
    const sql = getSqlClient();
    data = await getEmberData(sql);
  } catch {
    return (
      <Container>
        <div className="py-[80px] text-center mb-[96px]">
          <p className="font-serif text-[20px] text-muted mb-[12px]">
            Dashboard unavailable.
          </p>
          <p className="font-sans text-[14px] text-hint">
            Database not configured. Check environment variables.
          </p>
        </div>
      </Container>
    );
  }

  const { clusters, countyConditions } = data;

  return (
    <Container>
      <div className="mb-[40px]">
        <div className="flex items-center justify-between mb-[16px]">
          <SectionLabel>Live dashboard</SectionLabel>
          <Link
            href="/work"
            className="font-mono text-[12px] text-muted no-underline hover:text-accent transition-colors duration-[120ms]"
          >
            ← All projects
          </Link>
        </div>
        <h1 className="font-serif text-[44px] font-medium leading-[1.15] tracking-[-0.015em] text-ink mb-[16px]">
          EmberBrief
        </h1>
        <p className="font-sans text-[16px] leading-[1.65] text-ink-soft max-w-[580px]">
          Satellite fire detection for Shasta County — clusters updated every 10 minutes
          from NASA FIRMS, with NOAA weather and AI-generated situation briefings for
          high-risk events.
        </p>
      </div>

      {/* County conditions */}
      {countyConditions && (
        <CountyConditionsHeader conditions={countyConditions} />
      )}

      {/* Cluster section */}
      <div className="mb-[96px]">
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
          <div className="py-[60px] text-center border border-line rounded-sm">
            <p className="font-serif text-[20px] text-muted mb-[12px]">
              No active detections.
            </p>
            <p className="font-sans text-[14px] text-hint">
              The pipeline runs every 10 minutes. Check back shortly.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-[12px]">
            {clusters.map((cluster) => (
              <ClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
