"use client";

// PaletteSkeleton.tsx — interactive UI for the seasonal palette app. A hex input is
// normalized, snapped into the season's gamut, and assembled into a four-role outfit
// palette (Base / Secondary / Neutral / Accent) via the complementary harmony scheme.
// Multiple schemes, the season selector, and polish arrive in later slices (#224, #223).

import { useMemo, useState } from "react";
import type { Season } from "@/lib/palette/season-data";
import { normalizeHex } from "@/lib/palette/color-math";
import { buildPalettes } from "@/lib/palette/palette-assembler";
import { PaletteCard } from "./PaletteCard";

interface PaletteSkeletonProps {
  season: Season;
}

export function PaletteSkeleton({ season }: PaletteSkeletonProps) {
  const [input, setInput] = useState("#7fb0d0");

  const normalized = useMemo(() => normalizeHex(input), [input]);
  const palettes = useMemo(
    () => (normalized ? buildPalettes(normalized, season.colors) : []),
    [normalized, season.colors]
  );

  return (
    <div className="flex flex-col gap-[36px]">
      <div className="flex flex-col gap-[12px] max-w-[520px]">
        <label
          htmlFor="palette-hex"
          className="font-sans text-[14px] font-medium text-ink-soft"
        >
          Enter a color (hex)
        </label>
        <div className="flex items-center gap-[12px]">
          <div
            aria-hidden
            className="rounded-sm border border-line-strong shrink-0"
            style={{
              backgroundColor: normalized ?? "transparent",
              width: 40,
              height: 40,
            }}
          />
          <input
            id="palette-hex"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="#7fb0d0"
            className="font-mono text-[15px] text-ink bg-bg-soft border border-line rounded-sm px-[14px] py-[10px] w-[220px] outline-none focus:border-accent"
          />
        </div>
        {normalized === null && input.trim() !== "" && (
          <span className="font-sans text-[13px] text-clay">
            Not a color I can read — try a hex like <span className="font-mono">#7fb0d0</span>.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-[16px]">
        <p className="font-sans text-[14px] text-hint max-w-[520px]">
          Your color becomes the <strong className="text-ink-soft font-medium">Base</strong>,
          snapped to its nearest shade in {season.name}. From it the app builds a few four-role
          outfit palettes — one per harmony scheme — every color guaranteed to stay in-season.
        </p>
        {palettes.length > 0 ? (
          <div className="flex flex-col gap-[20px]">
            {palettes.map((palette) => (
              <PaletteCard key={palette.scheme} palette={palette} />
            ))}
          </div>
        ) : (
          <p className="font-serif text-[18px] text-muted">
            Enter a valid hex to build in-season palettes.
          </p>
        )}
      </div>
    </div>
  );
}
