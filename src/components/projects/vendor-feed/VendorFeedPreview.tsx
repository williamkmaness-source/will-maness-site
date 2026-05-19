// VendorFeedPreview.tsx — compact read-only feed preview for the vendor-feed project page.
// Shows the 7 most recent entities above the "How it works" section.
// Fetches server-side; degrades gracefully if no entities exist yet.

import Link from "next/link";
import { getFeedEntities } from "@/lib/vendor-feed/feed-queries";
import type { FeedEntity, EntityType } from "@/lib/vendor-feed/feed-queries";

const TYPE_BADGE: Record<EntityType, string> = {
  feature_launch: "bg-accent text-bg",
  pricing_change: "bg-clay text-bg",
  partnership: "bg-accent-soft text-accent",
  architectural_shift: "bg-ink text-bg",
};

const TYPE_LABEL: Record<EntityType, string> = {
  feature_launch: "Feature Launch",
  pricing_change: "Pricing Change",
  partnership: "Partnership",
  architectural_shift: "Architecture",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date unknown";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Date unknown";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function PreviewCard({ entity }: { entity: FeedEntity }) {
  const badge = TYPE_BADGE[entity.entityType];
  const label = TYPE_LABEL[entity.entityType];

  return (
    <div className="py-[14px] border-b border-line last:border-b-0">
      <div className="flex items-baseline gap-[10px] flex-wrap">
        <span
          className={`inline-block font-mono text-[10px] tracking-[0.04em] px-[7px] py-[2px] rounded-sm shrink-0 ${badge}`}
        >
          {label}
        </span>
        <span className="font-mono text-[12px] text-muted shrink-0">{entity.company}</span>
        <span className="font-serif text-[15px] leading-[1.4] text-ink flex-1 min-w-[160px]">
          {entity.title}
        </span>
        <span className="font-mono text-[11px] text-hint shrink-0 ml-auto">
          {formatDate(entity.date)}
        </span>
      </div>
    </div>
  );
}

export async function VendorFeedPreview() {
  let entities: FeedEntity[] = [];

  try {
    const all = await getFeedEntities();
    entities = all.slice(0, 7);
  } catch {
    // No DB connection or empty — degrade silently
  }

  if (entities.length === 0) {
    return null;
  }

  return (
    <div className="my-[40px]">
      <p className="font-mono text-[11px] text-hint tracking-[0.04em] uppercase mb-[12px]">
        Recent from the feed
      </p>
      <div className="border-t border-line">
        {entities.map((entity) => (
          <PreviewCard key={entity.id} entity={entity} />
        ))}
      </div>
      <div className="mt-[16px]">
        <Link
          href="/work/vendor_feed"
          className="font-mono text-[12px] text-accent no-underline hover:underline"
        >
          View full feed →
        </Link>
      </div>
    </div>
  );
}
