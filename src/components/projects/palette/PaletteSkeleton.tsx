"use client";

// PaletteSkeleton.tsx — interactive UI for the seasonal palette app. The user picks a season,
// a color arrives from either input mode (hex field or swatch grid), is snapped into that
// season's gamut, and is assembled into four-role outfit palettes across every harmony
// scheme. Results track the last color the engine accepted, so a half-typed hex never blanks
// the cards. Seasons come in as data — this component never names one.

import { useCallback, useMemo, useState } from "react";
import type { Season, SeasonId } from "@/lib/palette/season-data";
import { normalizeHex } from "@/lib/palette/color-math";
import { buildPalettes } from "@/lib/palette/palette-assembler";
import { ColorInput } from "./ColorInput";
import { PaletteCard } from "./PaletteCard";
import { SeasonSelector } from "./SeasonSelector";

const DEFAULT_COLOR = "#7fb0d0";

interface PaletteSkeletonProps {
  /** Every selectable season, in display order. */
  seasons: Season[];
  /** Which season is active on first render. Falls back to the first entry. */
  initialSeasonId?: SeasonId;
}

export function PaletteSkeleton({ seasons, initialSeasonId }: PaletteSkeletonProps) {
  const [seasonId, setSeasonId] = useState<SeasonId>(
    () => initialSeasonId ?? seasons[0].id
  );
  // Guard against an initialSeasonId that isn't in `seasons` so the UI can't land on a
  // season with no data.
  const season = useMemo(
    () => seasons.find((entry) => entry.id === seasonId) ?? seasons[0],
    [seasons, seasonId]
  );

  const [input, setInput] = useState(DEFAULT_COLOR);
  // The last color that actually parsed. Held separately from the raw field text so an
  // in-progress or invalid entry leaves the current results standing.
  const [resolved, setResolved] = useState(DEFAULT_COLOR);

  const handleChange = useCallback((next: string) => {
    setInput(next);
    const normalized = normalizeHex(next);
    if (normalized) setResolved(normalized);
  }, []);

  const invalid = useMemo(
    () => input.trim() !== "" && normalizeHex(input) === null,
    [input]
  );

  // Recomputes whenever the accepted color or the season's gamut changes. A season with no
  // colors is guarded here rather than left to the assembler, which throws on an empty
  // gamut — the empty result falls through to the message below.
  const palettes = useMemo(
    () => (season.colors.length > 0 ? buildPalettes(resolved, season.colors) : []),
    [resolved, season.colors]
  );

  return (
    <div className="flex flex-col gap-[36px]">
      <SeasonSelector
        seasons={seasons}
        activeId={season.id}
        onSelect={setSeasonId}
      />

      <ColorInput
        season={season}
        value={input}
        resolved={resolved}
        invalid={invalid}
        onChange={handleChange}
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
            No colors are defined for {season.name} yet.
          </p>
        )}
      </div>
    </div>
  );
}
