"use client";

// MusicAnalyzerTabs.tsx — the analyzer's three views behind one tablist (issue #216).
// Each panel keeps its own state while mounted, so switching tabs and coming back doesn't
// discard a lookup. Tab styling matches the palette project's ColorInput tablist.

import { useId, useState } from "react";
import { SongLookup } from "./SongLookup";
import { SongCompare } from "./SongCompare";
import { Top100Dashboard } from "./Top100Dashboard";
import { cn } from "@/lib/utils";

type ViewId = "lookup" | "compare" | "top100";

const VIEWS: { id: ViewId; label: string }[] = [
  { id: "lookup", label: "Song lookup" },
  { id: "compare", label: "Compare" },
  { id: "top100", label: "Top 100" },
];

export function MusicAnalyzerTabs() {
  const [view, setView] = useState<ViewId>("lookup");
  const baseId = useId();

  return (
    <div className="flex flex-col gap-[28px]">
      <div role="tablist" aria-label="Music analyzer views" className="flex gap-[4px] flex-wrap">
        {VIEWS.map(({ id, label }) => {
          const isActive = view === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${id}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${id}`}
              onClick={() => setView(id)}
              className={cn(
                "font-sans text-[13px] font-medium rounded-sm px-[14px] py-[9px] border outline-none transition-colors cursor-pointer",
                isActive
                  ? "border-accent text-ink bg-bg-soft"
                  : "border-line text-muted hover:text-ink-soft hover:border-line-strong focus-visible:border-accent"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${view}`}
        aria-labelledby={`${baseId}-tab-${view}`}
      >
        {view === "lookup" && <SongLookup />}
        {view === "compare" && <SongCompare />}
        {view === "top100" && <Top100Dashboard />}
      </div>
    </div>
  );
}
