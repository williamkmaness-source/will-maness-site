"use client";

// SongSearchPanel.tsx — search field plus result states for one song (issues #216, #217).
// Fully controlled: the caller owns the useSongSearch instance, which is what lets the
// compare view read both columns' results to diff them while each column still searches
// independently. Every non-ready state is designed copy — never a raw fetch error.

import { useId, useState } from "react";
import type { FeatureName } from "@/lib/music-analyzer/music-queries";
import { SongBreakdown } from "./SongBreakdown";
import type { SongSearchState } from "./use-song-search";

const COPY = {
  placeholder: "Search a song title",
  submit: "Look up",
  loading: "Looking it up…",
  empty: "No song on Spotify matched that search. Try the full title, or add the artist.",
  error: "The lookup didn't come back. Try again in a moment.",
  noTrendData:
    "No trend data yet — the weekly top 100 pipeline hasn't produced a snapshot, so features show without ratings.",
} as const;

interface SongSearchPanelProps extends SongSearchState {
  label: string;
  onSearch: (query: string) => void;
  /** Feature rows to mark as differing; supplied by the compare view. */
  highlightedFeatures?: ReadonlySet<FeatureName>;
}

export function SongSearchPanel({
  label,
  status,
  breakdown,
  error,
  onSearch,
  highlightedFeatures,
}: SongSearchPanelProps) {
  const [query, setQuery] = useState("");
  const fieldId = useId();

  return (
    <div className="flex flex-col gap-[18px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(query);
        }}
        className="flex flex-col gap-[8px]"
      >
        <label
          htmlFor={fieldId}
          className="font-mono text-[11px] text-hint tracking-[0.06em] uppercase"
        >
          {label}
        </label>
        <div className="flex gap-[8px]">
          <input
            id={fieldId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={COPY.placeholder}
            className="flex-1 min-w-0 font-sans text-[15px] text-ink bg-bg border border-line-strong rounded-sm px-[12px] py-[9px] outline-none focus:border-accent transition-colors duration-[120ms]"
          />
          <button
            type="submit"
            className="font-mono text-[12px] tracking-[0.04em] text-bg bg-accent rounded-sm px-[14px] py-[9px] shrink-0 hover:opacity-90 transition-opacity duration-[120ms]"
          >
            {COPY.submit}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {status === "loading" && (
          <p className="font-sans text-[14px] text-muted py-[24px]">{COPY.loading}</p>
        )}
        {status === "empty" && (
          <p className="font-sans text-[14px] text-muted py-[24px]">{COPY.empty}</p>
        )}
        {status === "error" && (
          <p className="font-sans text-[14px] text-muted py-[24px]">{error ?? COPY.error}</p>
        )}
        {status === "ready" && breakdown && (
          <>
            <SongBreakdown breakdown={breakdown} highlightedFeatures={highlightedFeatures} />
            {!breakdown.snapshotWeek && (
              <p className="font-sans text-[13px] text-hint mt-[14px]">{COPY.noTrendData}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
