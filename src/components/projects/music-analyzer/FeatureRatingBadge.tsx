// FeatureRatingBadge.tsx — the hot-to-indie pill (issue #216).
// One badge for all three views, so a "Trending" chord flavor reads identically in the
// lookup, compare, and top 100 tables. A null rating renders a muted "no trend data"
// pill rather than nothing, so the row height never jumps between rated and unrated.

import type { FeatureRating } from "@/lib/music-analyzer/music-queries";
import { RATING_LABEL, UNRATED_LABEL } from "./labels";
import { cn } from "@/lib/utils";

// Warmth descends with popularity: clay for the crowded end of the chart, moss for the
// sparse end, plain paper for anything the pipeline hasn't scored.
const RATING_STYLE: Record<FeatureRating, string> = {
  hot: "bg-clay text-bg",
  trending: "bg-clay-soft text-clay",
  emerging: "bg-accent-soft text-accent",
  indie: "bg-bg-soft text-muted",
};

interface FeatureRatingBadgeProps {
  rating: FeatureRating | null;
  /** How many top 100 tracks share this feature value; hidden when unscored. */
  count?: number | null;
}

export function FeatureRatingBadge({ rating, count }: FeatureRatingBadgeProps) {
  const label = rating ? RATING_LABEL[rating] : UNRATED_LABEL;

  return (
    <span className="inline-flex items-center gap-[6px] shrink-0">
      <span
        className={cn(
          "inline-block font-mono text-[10px] tracking-[0.04em] px-[7px] py-[2px] rounded-sm whitespace-nowrap",
          rating ? RATING_STYLE[rating] : "bg-bg-soft text-hint"
        )}
      >
        {label}
      </span>
      {rating && typeof count === "number" && (
        <span className="font-mono text-[11px] text-hint whitespace-nowrap">
          {count}/100
        </span>
      )}
    </span>
  );
}
