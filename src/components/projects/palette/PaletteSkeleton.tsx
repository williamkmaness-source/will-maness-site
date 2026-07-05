"use client";

// PaletteSkeleton.tsx — walking-skeleton UI for the seasonal palette app (issue #221).
// Proves the full pipeline end-to-end: a hex input is normalized, snapped to the nearest
// color in the season's gamut, and rendered as the in-season "Base" swatch. Deliberately
// minimal — harmony schemes, roles, the season selector, and polish arrive in later slices.

import { useMemo, useState } from "react";
import type { Season } from "@/lib/palette/season-data";
import { normalizeHex } from "@/lib/palette/color-math";
import { nearestInGamut } from "@/lib/palette/gamut-snap";
import { SectionLabel } from "@/components/ui/SectionLabel";

interface PaletteSkeletonProps {
  season: Season;
}

// A single labeled color chip. Colors are data (hex from the season set / user input),
// so they render via inline style; all chrome stays on design tokens.
function Swatch({
  hex,
  label,
  size = 96,
}: {
  hex: string;
  label: string;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-start gap-[8px]">
      <div
        className="rounded-md border border-line-strong"
        style={{ backgroundColor: hex, width: size, height: size }}
      />
      <div className="flex flex-col">
        <SectionLabel>{label}</SectionLabel>
        <span className="font-mono text-[13px] text-muted tabular-nums">{hex}</span>
      </div>
    </div>
  );
}

export function PaletteSkeleton({ season }: PaletteSkeletonProps) {
  const [input, setInput] = useState("#7fb0d0");

  const normalized = useMemo(() => normalizeHex(input), [input]);
  const base = useMemo(
    () => (normalized ? nearestInGamut(normalized, season.colors) : null),
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
        <div className="flex flex-col gap-[4px]">
          <SectionLabel>Base — snapped to {season.name}</SectionLabel>
          <p className="font-sans text-[14px] text-hint max-w-[520px]">
            Your color, moved to the nearest shade inside the {season.name} palette. Every
            color the app suggests starts from this in-season anchor.
          </p>
        </div>
        {base ? (
          <Swatch hex={base} label="Base" />
        ) : (
          <p className="font-serif text-[18px] text-muted">
            Enter a valid hex to see its in-season anchor.
          </p>
        )}
      </div>
    </div>
  );
}
