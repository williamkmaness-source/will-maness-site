// season-data.ts — typed seasonal color data for the palette app. One entry per season;
// the `colors` array is the single source of truth for both the swatch picker options and
// the constraint gamut. The engine (gamut-snap, harmony, palette-assembler) is generic over
// `string[]`, so nothing downstream branches on which season it was handed.
//
// Adding a season is a data-only change: add its id to `SeasonId`, export a `Season` const
// below, and add that const to `SEASONS`. TypeScript's exhaustive `Record<SeasonId, Season>`
// makes a forgotten entry a compile error, and season-data.test.ts validates the hexes. No
// engine or component change is required — `SEASON_LIST` drives the selector and the picker.

export type SeasonId = "light-summer" | "dull-winter"; // extend to the full twelve later

export interface Season {
  id: SeasonId;
  name: string;
  /** Short human description shown alongside the swatches. */
  blurb: string;
  /** ~20–40 hex codes: the full seasonal palette, doubling as the constraint gamut. */
  colors: string[];
}

/** Bounds every season's `colors` set is expected to fall within (enforced by tests). */
export const SEASON_COLOR_COUNT = { min: 20, max: 40 } as const;

// Light Summer: light, cool, soft, low-to-medium chroma. Drawn from a standard 12-season
// reference set.
export const LIGHT_SUMMER: Season = {
  id: "light-summer",
  name: "Light Summer",
  blurb:
    "Light, cool, and soft — gentle rose, powder blue, periwinkle, and muted aqua, grounded by cool greys rather than a hard black.",
  colors: [
    "#F1D7DD",
    "#E6B9C6",
    "#D896AC",
    "#C77E99",
    "#BFA9B4",
    "#C2D0E4",
    "#9DB4DA",
    "#7791C6",
    "#5E79B0",
    "#AEBFD0",
    "#8AA7BB",
    "#A9D4CE",
    "#7FC1B7",
    "#B9DBD3",
    "#64A8A0",
    "#CDBBDD",
    "#A98FC6",
    "#8574A6",
    "#D9CFE4",
    "#D5CFC3",
    "#BDB7AB",
    "#9C97A0",
    "#6F6B74",
    "#46536A",
  ],
};

// Dull Winter: cool and deep like every Winter, but softened — chroma is greyed down rather
// than clear and icy, and the darks stop short of true black. Drawn from a standard
// 12-season reference set.
export const DULL_WINTER: Season = {
  id: "dull-winter",
  name: "Dull Winter",
  blurb:
    "Cool and deep, but softened — greyed berry, slate blue, muted plum, and dark pine, anchored by charcoal and cool grey instead of a stark black.",
  colors: [
    // Greyed roses and berries
    "#C9A3AE",
    "#B3808F",
    "#96606F",
    "#8C4A5C",
    "#6B2F3F",
    // Muted plums and violets
    "#C0BCC2",
    "#A38FB0",
    "#7E6689",
    "#5C4A66",
    "#43354D",
    // Slate blues through navy
    "#8FA3BE",
    "#6B84A6",
    "#4A6285",
    "#2E4260",
    "#1F2C42",
    // Cool, dulled greens and teals
    "#7FA6A3",
    "#547E7C",
    "#35595A",
    "#4E6B5C",
    "#2F4A3E",
    // Cool neutrals — the grounding tones
    "#D2D4D6",
    "#ADB1B6",
    "#868C93",
    "#5F656C",
    "#3A3E44",
    "#23262A",
  ],
};

/**
 * Every season, keyed by id. Typed as an exhaustive record so adding a `SeasonId` without
 * its data entry fails to compile.
 */
export const SEASONS: Record<SeasonId, Season> = {
  "light-summer": LIGHT_SUMMER,
  "dull-winter": DULL_WINTER,
};

/** Seasons in display order — what the selector and any season listing iterate over. */
export const SEASON_LIST: Season[] = Object.values(SEASONS);

/** The season shown before the user picks one. */
export const DEFAULT_SEASON_ID: SeasonId = "light-summer";

/** Look up a season by id. Returns undefined for an id outside the shipped set. */
export function getSeason(id: string): Season | undefined {
  return SEASONS[id as SeasonId];
}
