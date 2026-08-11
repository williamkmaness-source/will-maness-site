"use client";

// SeasonSelector.tsx — picks which season's gamut the engine runs against. Renders one
// option per entry in the seasons it is handed, plus the active season's blurb, so the
// control grows straight from season-data with no per-season markup here.

import type { Season, SeasonId } from "@/lib/palette/season-data";
import { cn } from "@/lib/utils";

interface SeasonSelectorProps {
  seasons: Season[];
  activeId: SeasonId;
  onSelect: (id: SeasonId) => void;
}

export function SeasonSelector({ seasons, activeId, onSelect }: SeasonSelectorProps) {
  const active = seasons.find((season) => season.id === activeId);

  return (
    <div className="flex flex-col gap-[10px] max-w-[560px]">
      <span className="font-sans text-[14px] font-medium text-ink-soft">Your season</span>
      <div role="radiogroup" aria-label="Your season" className="flex flex-wrap gap-[4px]">
        {seasons.map(({ id, name }) => {
          const isActive = id === activeId;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onSelect(id)}
              className={cn(
                "font-sans text-[13px] font-medium rounded-sm px-[14px] py-[9px] border outline-none transition-colors cursor-pointer",
                isActive
                  ? "border-accent text-ink bg-bg-soft"
                  : "border-line text-muted hover:text-ink-soft hover:border-line-strong focus-visible:border-accent"
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
      {active && (
        <p aria-live="polite" className="font-sans text-[14px] text-hint">
          {active.blurb}
        </p>
      )}
    </div>
  );
}
