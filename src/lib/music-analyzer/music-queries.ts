// music-queries.ts — Postgres reads for the music analyzer (issue #216).
// Two reads only: the latest weekly hot-to-indie score snapshot (used to rate any
// on-demand song lookup) and the latest top 100 snapshot with its extracted features.
// Follows the connection + typing pattern of src/lib/vendor-feed/feed-queries.ts.

import { neon } from "@neondatabase/serverless";

export const FEATURE_NAMES = [
  "key_mode",
  "bpm_range",
  "song_structure",
  "chord_flavor",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

/** Hot-to-indie rating bands, ordered most to least common in the top 100. */
export const FEATURE_RATINGS = ["hot", "trending", "emerging", "indie"] as const;

export type FeatureRating = (typeof FEATURE_RATINGS)[number];

export interface FeatureScore {
  featureName: FeatureName;
  featureValue: string;
  /** How many of the current top 100 tracks share this feature value. */
  count: number;
  rating: FeatureRating;
}

export interface FeatureScoreSnapshot {
  snapshotWeek: string;
  scores: FeatureScore[];
}

export interface Top100Track {
  rank: number;
  title: string;
  artist: string;
  features: Record<FeatureName, string | null>;
}

export interface Top100Snapshot {
  snapshotWeek: string;
  tracks: Top100Track[];
}

function connect() {
  const connectionString =
    process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("No Postgres connection string found");
  return neon(connectionString);
}

function isFeatureName(value: string): value is FeatureName {
  return (FEATURE_NAMES as readonly string[]).includes(value);
}

// `music_feature_scores.rating` is an unconstrained text column, so a value outside the
// four bands would otherwise reach the UI and render an unstyled, unlabelled badge.
function isFeatureRating(value: string): value is FeatureRating {
  return (FEATURE_RATINGS as readonly string[]).includes(value);
}

/**
 * The most recent week the pipeline scored, or null if it has never run.
 * On-demand song lookups are always rated against this snapshot.
 */
export async function getLatestFeatureScores(): Promise<FeatureScoreSnapshot | null> {
  const sql = connect();

  const rows = (await sql`
    SELECT snapshot_week::text AS snapshot_week, feature_name, feature_value, count, rating
    FROM music_feature_scores
    WHERE snapshot_week = (SELECT MAX(snapshot_week) FROM music_feature_scores)
  `) as {
    snapshot_week: string;
    feature_name: string;
    feature_value: string;
    count: number;
    rating: string;
  }[];

  if (rows.length === 0) return null;

  return {
    snapshotWeek: rows[0].snapshot_week,
    // Rows the type system can't vouch for are dropped rather than cast through:
    // findScore then returns null for them and the UI shows "no trend data", which is
    // the same degradation path an absent snapshot already takes.
    scores: rows.flatMap((row) => {
      const { feature_name: featureName, rating } = row;
      if (!isFeatureName(featureName) || !isFeatureRating(rating)) return [];
      return [
        {
          featureName,
          featureValue: row.feature_value,
          count: Number(row.count),
          rating,
        },
      ];
    }),
  };
}

/**
 * Look up one feature value in a snapshot. Returns null when the pipeline has
 * never seen that value — a song can legitimately use a key no top 100 track does.
 */
export function findScore(
  snapshot: FeatureScoreSnapshot | null,
  featureName: FeatureName,
  featureValue: string
): FeatureScore | null {
  if (!snapshot) return null;
  return (
    snapshot.scores.find(
      (score) => score.featureName === featureName && score.featureValue === featureValue
    ) ?? null
  );
}

/**
 * The current top 100 with precomputed features. Null when the pipeline has never
 * run. Tracks scraped but not yet feature-extracted come back with null features
 * rather than being dropped, so the dashboard can show the full 100 either way.
 */
export async function getLatestTop100(): Promise<Top100Snapshot | null> {
  const sql = connect();

  const rows = (await sql`
    SELECT
      t.snapshot_week::text AS snapshot_week,
      t.rank,
      t.title,
      t.artist,
      f.key_mode,
      f.bpm_range,
      f.song_structure,
      f.chord_flavor
    FROM music_top100_tracks t
    LEFT JOIN music_track_features f
      ON f.track_id = t.id AND f.snapshot_week = t.snapshot_week
    WHERE t.snapshot_week = (SELECT MAX(snapshot_week) FROM music_top100_tracks)
    ORDER BY t.rank ASC
  `) as {
    snapshot_week: string;
    rank: number;
    title: string;
    artist: string;
    key_mode: string | null;
    bpm_range: string | null;
    song_structure: string | null;
    chord_flavor: string | null;
  }[];

  if (rows.length === 0) return null;

  return {
    snapshotWeek: rows[0].snapshot_week,
    tracks: rows.map((row) => ({
      rank: Number(row.rank),
      title: row.title,
      artist: row.artist,
      features: {
        key_mode: row.key_mode,
        bpm_range: row.bpm_range,
        song_structure: row.song_structure,
        chord_flavor: row.chord_flavor,
      },
    })),
  };
}
