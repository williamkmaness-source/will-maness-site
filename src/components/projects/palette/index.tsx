// index.tsx — MDX entry point for the seasonal palette project. Supplies the hardcoded
// Light Summer season to the interactive skeleton so the widget can be embedded in the
// project MDX with no props (<SeasonalPalette />), matching the other project components.

import { PaletteSkeleton } from "./PaletteSkeleton";
import { LIGHT_SUMMER } from "@/lib/palette/season-data";

export function SeasonalPalette() {
  return <PaletteSkeleton season={LIGHT_SUMMER} />;
}
