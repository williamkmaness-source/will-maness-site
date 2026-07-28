"use client";

// PaletteSkeleton.tsx — interactive UI for the seasonal palette app. A color arrives from
// either input mode (hex field or swatch grid), is snapped into the season's gamut, and is
// assembled into four-role outfit palettes (Base / Secondary / Neutral / Accent) across
// every harmony scheme. The season selector arrives in a later slice (#223).

import { useMemo, useState } from "react";
import type { Season } from "@/lib/palette/season-data";
import { normalizeHex } from "@/lib/palette/color-math";
import { buildPalettes } from "@/lib/palette/palette-assembler";
import { ColorInput } from "./ColorInput";
import { PaletteCard } from "./PaletteCard";

const DEFAULT_COLOR = "#7fb0d0";

interface PaletteSkeletonProps {
  season: Season;
}

export function PaletteSkeleton({ season }: PaletteSkeletonProps) {
  const [input, setInput] = useState(DEFAULT_COLOR);

  const normalized = useMemo(() => normalizeHex(input), [input]);
  const palettes = useMemo(
    () => (normalized ? buildPalettes(normalized, season.colors) : []),
    [normalized, season.colors]
  );

  return (
    <div className="flex flex-col gap-[36px]">
      <ColorInput
        season={season}
        value={input}
        resolved={normalized}
        invalid={normalized === null && input.trim() !== ""}
        onChange={setInput}
      />

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
