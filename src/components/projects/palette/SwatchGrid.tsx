"use client";

// SwatchGrid.tsx — the "Pick a swatch" half of the color input: every color in the active
// season's `colors[]` as a tappable button that feeds the same engine the hex field does.
// The swatch itself selects; its hex caption is a separate one-click copy control, so the
// two actions never compete for the same tap. Follows whichever season is passed in.

import type { Season } from "@/lib/palette/season-data";
import { useCopyHex } from "./use-copy-hex";
import { cn } from "@/lib/utils";

interface SwatchGridProps {
  season: Season;
  /** The color currently driving the engine, so the matching swatch can read as chosen. */
  selected: string | null;
  onSelect: (hex: string) => void;
}

export function SwatchGrid({ season, selected, onSelect }: SwatchGridProps) {
  const { copiedKey, copy } = useCopyHex();

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-[10px]">
      {season.colors.map((hex) => {
        const isSelected = selected?.toLowerCase() === hex.toLowerCase();
        const isCopied = copiedKey === hex;
        return (
          <div key={hex} className="flex flex-col gap-[4px] min-w-0">
            <button
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
            <button
              type="button"
              onClick={() => copy(hex, hex)}
              aria-label={`Copy ${hex.toUpperCase()}`}
              className={cn(
                "font-mono text-[10px] tabular-nums uppercase text-left truncate outline-none transition-colors cursor-pointer",
                isCopied
                  ? "text-accent"
                  : "text-hint hover:text-ink-soft focus-visible:text-accent"
              )}
            >
              <span aria-live="polite">{isCopied ? "Copied" : hex}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
