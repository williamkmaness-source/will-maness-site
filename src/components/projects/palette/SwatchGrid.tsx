"use client";

// SwatchGrid.tsx — the "Pick a swatch" half of the color input: every color in the active
// season's `colors[]` rendered as a tappable button. Picking one feeds the same engine the
// hex field does, so the two input modes are indistinguishable downstream. Reads the season
// off props, so it follows whichever season is active without knowing how one is chosen.

import type { Season } from "@/lib/palette/season-data";
import { cn } from "@/lib/utils";

interface SwatchGridProps {
  season: Season;
  /** The color currently driving the engine, so the matching swatch can read as chosen. */
  selected: string | null;
  onSelect: (hex: string) => void;
}

export function SwatchGrid({ season, selected, onSelect }: SwatchGridProps) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-[10px]">
      {season.colors.map((hex) => {
        const isSelected = selected?.toLowerCase() === hex.toLowerCase();
        return (
          <button
            key={hex}
            type="button"
            onClick={() => onSelect(hex)}
            aria-pressed={isSelected}
            aria-label={`Use ${hex.toUpperCase()} as the base color`}
            className={cn(
              "h-[44px] w-full rounded-sm border outline-none transition-colors cursor-pointer",
              isSelected
                ? "border-accent shadow-[0_0_0_2px_var(--color-accent-soft)]"
                : "border-line-strong hover:border-ink-soft focus-visible:border-accent"
            )}
            style={{ backgroundColor: hex }}
          />
        );
      })}
    </div>
  );
}
