// index.tsx — MDX entry point for the seasonal palette project. Hands the interactive
// skeleton every shipped season so the widget can be embedded in the project MDX with no
// props (<SeasonalPalette />), matching the other project components. Adding a season to
// season-data puts it in the selector here with no change to this file.

import { PaletteSkeleton } from "./PaletteSkeleton";
import { SEASON_LIST, DEFAULT_SEASON_ID } from "@/lib/palette/season-data";

export function SeasonalPalette() {
  return <PaletteSkeleton seasons={SEASON_LIST} initialSeasonId={DEFAULT_SEASON_ID} />;
}
