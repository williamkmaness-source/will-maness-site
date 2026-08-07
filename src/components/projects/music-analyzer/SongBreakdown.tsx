// SongBreakdown.tsx — the four-feature readout for one track (issue #216).
// Title, artist, then one row per feature dimension with its value and rating badge.
// `highlightedFeatures` is used by the compare view to mark rows that differ between
// two songs; on its own the lookup view passes nothing and no row is marked.

import type { SongBreakdownData } from "@/lib/music-analyzer/song-breakdown";
import type { FeatureName } from "@/lib/music-analyzer/music-queries";
import { FeatureRatingBadge } from "./FeatureRatingBadge";
import { FEATURE_LABEL } from "./labels";
import { cn } from "@/lib/utils";

interface SongBreakdownProps {
  breakdown: SongBreakdownData;
  /** Feature rows to visually distinguish (compare view marks the differing ones). */
  highlightedFeatures?: ReadonlySet<FeatureName>;
}

export function SongBreakdown({ breakdown, highlightedFeatures }: SongBreakdownProps) {
  return (
    <div>
      <div className="mb-[18px]">
        <h3 className="font-serif text-[22px] font-medium leading-[1.3] text-ink">
          {breakdown.title}
        </h3>
        <p className="font-sans text-[14px] text-muted mt-[4px]">{breakdown.artist}</p>
      </div>

      <dl className="border-t border-line">
        {breakdown.features.map((feature) => {
          const isHighlighted = highlightedFeatures?.has(feature.name) ?? false;
          return (
            <div
              key={feature.name}
              className={cn(
                "flex items-baseline justify-between gap-[12px] flex-wrap py-[12px] px-[10px] -mx-[10px] border-b border-line",
                isHighlighted && "bg-bg-soft rounded-sm"
              )}
            >
              <dt className="font-mono text-[11px] text-hint tracking-[0.04em] uppercase basis-full">
                {FEATURE_LABEL[feature.name]}
              </dt>
              <dd className="font-serif text-[17px] text-ink">{feature.value}</dd>
              <dd className="ml-auto">
                <FeatureRatingBadge rating={feature.rating} count={feature.count} />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
