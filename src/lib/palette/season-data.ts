// season-data.ts — typed seasonal color data for the palette app.
// One entry per season; the `colors` array is the single source of truth for both
// the swatch picker options and the constraint gamut. Adding a season = adding one
// entry, no engine changes. Skeleton ships Light Summer only; the type is already
// shaped for all twelve seasons (see issue #223 for the validated two-season set).

export type SeasonId =
  | "light-summer"
  | "dull-winter"; // extend to the full twelve later

export interface Season {
  id: SeasonId;
  name: string;
  /** Short human description shown alongside the swatches. */
  blurb: string;
  /** ~20–40 hex codes: the full seasonal palette, doubling as the constraint gamut. */
  colors: string[];
}

// Light Summer: light, cool, soft, low-to-medium chroma. This is a reasonable
// standard set for the walking skeleton; the definitive, visually-validated set is
// owned by issue #223.
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

export const SEASONS: Record<SeasonId, Season> = {
  "light-summer": LIGHT_SUMMER,
  // "dull-winter" arrives with issue #223.
} as Record<SeasonId, Season>;
