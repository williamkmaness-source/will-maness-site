// popularity-scorer.ts — Pure hot-to-indie rating for every feature value in the current top 100 (issue #215).
// No side effects, no DB or network dependencies: a deterministic function of the extracted feature set.

import type { ExtractedFeatures } from "./feature-extractor";

export type PopularityRating = "hot" | "trending" | "emerging" | "indie";

/** Feature names match the `music_track_features` / `music_feature_scores` column vocabulary. */
export const FEATURE_NAMES = [
  "key_mode",
  "bpm_range",
  "song_structure",
  "chord_flavor",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

export interface FeatureScore {
  feature_name: FeatureName;
  feature_value: string;
  count: number;
  rating: PopularityRating;
}

// Share of the comparison pool (as a percentage) at which each rating starts.
// A value in 25%+ of the top 100 is a formula everyone is using; a value in 1–3% is still indie.
export const HOT_THRESHOLD_PCT = 25;
export const TRENDING_THRESHOLD_PCT = 10;
export const EMERGING_THRESHOLD_PCT = 4;

/**
 * Rate one feature value by how much of the comparison pool shares it.
 *
 * Expressed as a share rather than a raw count so the rating stays meaningful when fewer than 100
 * tracks resolved (Spotify misses, extraction failures) — the pool is whatever actually scored.
 */
export function rateFeature(count: number, total: number): PopularityRating {
  if (total <= 0 || count <= 0) return "indie";

  const sharePct = (count / total) * 100;
  if (sharePct >= HOT_THRESHOLD_PCT) return "hot";
  if (sharePct >= TRENDING_THRESHOLD_PCT) return "trending";
  if (sharePct >= EMERGING_THRESHOLD_PCT) return "emerging";
  return "indie";
}

/**
 * Count every distinct value of every feature across the pool and rate each one.
 *
 * Returns rows ready to upsert into `music_feature_scores`, ordered by feature name (in
 * `FEATURE_NAMES` order) then by descending count, so the most common formula reads first.
 */
export function scoreFeatures(features: ExtractedFeatures[]): FeatureScore[] {
  const total = features.length;
  const scores: FeatureScore[] = [];

  for (const name of FEATURE_NAMES) {
    const counts = new Map<string, number>();

    for (const track of features) {
      const value = track[name];
      // Skip blanks so a failed extraction never becomes its own "empty" feature value.
      if (value === null || value === undefined || value === "") continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    const rated = [...counts.entries()]
      .map(([feature_value, count]) => ({
        feature_name: name,
        feature_value,
        count,
        rating: rateFeature(count, total),
      }))
      .sort((a, b) => b.count - a.count || a.feature_value.localeCompare(b.feature_value));

    scores.push(...rated);
  }

  return scores;
}
