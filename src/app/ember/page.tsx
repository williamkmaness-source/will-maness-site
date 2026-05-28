
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { getEmberData, getSqlClient } from "@/lib/ember/ember-queries";
import { CountyConditionsHeader } from "@/components/projects/ember/CountyConditionsHeader";
import { ClusterCard } from "@/components/projects/ember/ClusterCard";
import { PipelineStatus } from "@/components/projects/ember/PipelineStatus";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "EmberBrief — Lake Tahoe Basin Fire Dashboard | Will Maness",
  description:
    "Live satellite fire detection for the Lake Tahoe Basin — clusters, risk scores, and current weather conditions updated daily.",
};

function ZeroDetectionState({ redFlag }: { redFlag: boolean }) {
  return (
    <div className={[
      "py-[48px] px-[24px] text-center border rounded-sm",
      redFlag ? "border-clay bg-clay-soft" : "border-line bg-bg-soft",
    ].join(" ")}>
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

function ErrorState({ reason }: { reason: string }) {
  return (
    <Container>
      <div className="py-[80px] text-center mb-[96px]">
        <p className="font-serif text-[20px] text-muted mb-[12px]">
          Dashboard unavailable.
        </p>
        <p className="font-sans text-[14px] text-hint">{reason}</p>
      </div>
    </Container>
  );
}

export default async function EmberPage() {
  let sql;
  try {
    sql = getSqlClient();
  } catch {
    return <ErrorState reason="Database not configured. Check environment variables." />;
  }

  let data;
  try {
    data = await getEmberData(sql);
  } catch (err) {
    console.error("[ember/page] getEmberData failed:", err);
    return <ErrorState reason="Could not load fire data. The pipeline may still be initializing." />;
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
          Satellite fire detection for the Lake Tahoe Basin — clusters updated daily
          from NASA FIRMS, with NOAA weather and AI-generated situation briefings for
          high-risk events.
        </p>
      </div>

      <PipelineStatus lastCheckedAt={countyConditions?.observedAt ?? null} />

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
          <ZeroDetectionState redFlag={countyConditions?.redFlag ?? false} />
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
