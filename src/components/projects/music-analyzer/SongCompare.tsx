"use client";

// SongCompare.tsx — two songs side by side (issue #217).
// Each column owns its own search state, so searching one never resets the other.
// Once both columns have a result, features that differ are highlighted and the ones
// they share are called out — that contrast is the actual insight the view exists for.

import { useMemo } from "react";
import { FEATURE_NAMES, type FeatureName } from "@/lib/music-analyzer/music-queries";
import type { SongBreakdownData } from "@/lib/music-analyzer/song-breakdown";
import { SongSearchPanel } from "./SongSearchPanel";
import { useSongSearch } from "./use-song-search";
import { FEATURE_LABEL } from "./labels";

const COPY = {
  columnA: "First song",
  columnB: "Second song",
  prompt: "Look up a song in each column to see what separates them.",
  sharedPrefix: "Shared:",
  allDifferent: "These two share none of the four features.",
  allShared: "These two share all four features.",
} as const;

export function SongCompare() {
  const a = useSongSearch("a");
  const b = useSongSearch("b");

  const breakdownA = a.breakdown;
  const breakdownB = b.breakdown;

  const { differing, shared } = useMemo(() => {
    const diff = new Set<FeatureName>();
    const same: FeatureName[] = [];
    if (!breakdownA || !breakdownB) return { differing: diff, shared: same };

    const valueOf = (breakdown: SongBreakdownData, name: FeatureName) =>
      breakdown.features.find((f) => f.name === name)?.value;

    for (const name of FEATURE_NAMES) {
      if (valueOf(breakdownA, name) === valueOf(breakdownB, name)) same.push(name);
      else diff.add(name);
    }
    return { differing: diff, shared: same };
  }, [breakdownA, breakdownB]);

  const bothReady = Boolean(a.breakdown && b.breakdown);

  return (
    <div className="flex flex-col gap-[28px]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[36px]">
        <SongSearchPanel
          label={COPY.columnA}
          status={a.status}
          breakdown={a.breakdown}
          error={a.error}
          onSearch={(query) => void a.search(query)}
          highlightedFeatures={bothReady ? differing : undefined}
        />
        <SongSearchPanel
          label={COPY.columnB}
          status={b.status}
          breakdown={b.breakdown}
          error={b.error}
          onSearch={(query) => void b.search(query)}
          highlightedFeatures={bothReady ? differing : undefined}
        />
      </div>

      <p className="font-sans text-[13px] text-hint border-t border-line pt-[16px]">
        {!bothReady
          ? COPY.prompt
          : shared.length === 0
            ? COPY.allDifferent
            : shared.length === FEATURE_NAMES.length
              ? COPY.allShared
              : `${COPY.sharedPrefix} ${shared.map((name) => FEATURE_LABEL[name]).join(", ")}.`}
      </p>
    </div>
  );
}
