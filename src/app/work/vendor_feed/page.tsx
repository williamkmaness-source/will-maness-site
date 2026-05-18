// app/work/vendor_feed/page.tsx — public market intelligence feed.
// Server component; reads from Neon at request time (no static caching).
// Data source: vf_feature_launches, vf_pricing_changes, vf_partnerships, vf_architectural_shifts.

import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { getFeedEntities, type FeedEntity, type EntityType } from "@/lib/vendor-feed/feed-queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vendor Intelligence Feed — Will Maness",
  description:
    "Automated market intelligence tracking feature launches, pricing changes, partnerships, and architecture shifts across data integration companies.",
};

// ── Entity type config ────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  EntityType,
  { label: string; badgeClass: string }
> = {
  feature_launch: {
    label: "Feature Launch",
    badgeClass: "bg-accent text-bg",
  },
  pricing_change: {
    label: "Pricing Change",
    badgeClass: "bg-clay text-bg",
  },
  partnership: {
    label: "Partnership",
    badgeClass: "bg-accent-soft text-accent",
  },
  architectural_shift: {
    label: "Architecture",
    badgeClass: "bg-bg-soft text-ink-soft border border-line",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date unknown";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Date unknown";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EntityBadge({ type }: { type: EntityType }) {
  const { label, badgeClass } = TYPE_CONFIG[type];
  return (
    <span
      className={`inline-block font-mono text-[11px] tracking-[0.04em] px-[8px] py-[3px] rounded-sm ${badgeClass}`}
    >
      {label}
    </span>
  );
}

function EntityCard({ entity }: { entity: FeedEntity }) {
  return (
    <article className="py-[28px] border-b border-line last:border-b-0">
      <div className="flex items-start justify-between gap-[16px] mb-[10px]">
        <div className="flex items-center gap-[10px] flex-wrap">
          <EntityBadge type={entity.entityType} />
          <span className="font-mono text-[12px] text-muted">{entity.company}</span>
        </div>
        <span className="font-mono text-[12px] text-hint shrink-0">
          {formatDate(entity.date)}
        </span>
      </div>

      <h2 className="font-serif text-[20px] font-medium leading-[1.3] tracking-[-0.01em] text-ink mb-[8px]">
        {entity.title}
      </h2>

      <p className="font-sans text-[15px] leading-[1.65] text-ink-soft mb-[14px]">
        {entity.description}
      </p>

      <a
        href={entity.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[12px] text-accent no-underline hover:underline"
      >
        Source →
      </a>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="py-[80px] text-center">
      <p className="font-serif text-[20px] text-muted mb-[12px]">No entities yet.</p>
      <p className="font-sans text-[14px] text-hint">
        The pipeline runs daily. Check back after the first run.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function VendorFeedPage() {
  const entities = await getFeedEntities();

  return (
    <Container>
      <div className="mb-[48px]">
        <div className="flex items-center justify-between mb-[16px]">
          <SectionLabel>Live feed</SectionLabel>
          <Link
            href="/work"
            className="font-mono text-[12px] text-muted no-underline hover:text-accent transition-colors duration-[120ms]"
          >
            ← All projects
          </Link>
        </div>
        <h1 className="font-serif text-[44px] font-medium leading-[1.15] tracking-[-0.015em] text-ink mb-[16px]">
          Vendor intelligence
        </h1>
        <p className="font-sans text-[16px] leading-[1.65] text-ink-soft max-w-[580px]">
          Automated tracking of feature launches, pricing changes, partnerships, and architecture
          shifts across data integration and ingestion companies — updated daily.
        </p>
      </div>

      {entities.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mb-[96px]">
          <div className="font-mono text-[12px] text-hint mb-[24px]">
            {entities.length} {entities.length === 1 ? "entity" : "entities"} tracked
          </div>
          {entities.map((entity) => (
            <EntityCard key={entity.id} entity={entity} />
          ))}
        </div>
      )}
    </Container>
  );
}
