"use client";

// SongLookup.tsx — the analyzer's primary view (issue #216).
// One search box; on submit it calls /api/music/song and renders the four-feature
// breakdown with hot-to-indie ratings. Owns the search state so SongSearchPanel stays
// a controlled presentation component shared with the compare view.

import { SongSearchPanel } from "./SongSearchPanel";
import { useSongSearch } from "./use-song-search";

const LABEL = "Song";

export function SongLookup() {
  const { status, breakdown, error, search } = useSongSearch("q");

  return (
    <div className="max-w-[560px]">
      <SongSearchPanel
        label={LABEL}
        status={status}
        breakdown={breakdown}
        error={error}
        onSearch={(query) => void search(query)}
      />
    </div>
  );
}
