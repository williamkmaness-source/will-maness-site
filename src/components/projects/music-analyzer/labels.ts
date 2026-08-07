// labels.ts — display strings for the music analyzer's four feature dimensions and
// four hot-to-indie rating bands (issues #216, #218). Kept in one place so the lookup,
// compare, and top 100 views never drift on wording.

import type { FeatureName, FeatureRating } from "@/lib/music-analyzer/music-queries";

export const FEATURE_LABEL: Record<FeatureName, string> = {
  key_mode: "Key & mode",
  bpm_range: "BPM range",
  song_structure: "Song structure",
  chord_flavor: "Chord flavor",
};

export const RATING_LABEL: Record<FeatureRating, string> = {
  hot: "Hot",
  trending: "Trending",
  emerging: "Emerging",
  indie: "Indie",
};

/** Shown in place of a rating when the pipeline has no data for a value. */
export const UNRATED_LABEL = "No trend data";
