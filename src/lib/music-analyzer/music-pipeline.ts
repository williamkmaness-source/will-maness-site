// music-pipeline.ts — DB-facing scrape/extract/score steps for the music analyzer pipeline (issue #215).
// Each step is independently runnable and idempotent for a given snapshot week. Imported by both
// scripts/pipeline-music.ts (CLI) and the music-ingest cron route, mirroring the vendor-feed split
// where the runnable logic lives in lib/ and the script is a thin command dispatcher.

import type { NeonQueryFunction } from "@neondatabase/serverless";
import pLimit from "p-limit";
import { fetchHot100 } from "./billboard-scraper";
import { extractFeatures, type ExtractedFeatures } from "./feature-extractor";
import { scoreFeatures, FEATURE_NAMES, type FeatureScore } from "./popularity-scorer";
import type { SpotifyClient } from "./spotify-client";

export const PIPELINE_NAME = "music";

// Spotify allows generous burst traffic but rate-limits hard; 6-way concurrency keeps a full
// 100-track extract inside a serverless invocation without tripping 429s.
const EXTRACT_CONCURRENCY = 6;

/** Max tracks to extract per invocation. A partial run resumes on the next one (rows are skipped once features exist). */
export const EXTRACT_BATCH_LIMIT = 100;

type Sql = NeonQueryFunction<false, false>;

/**
 * The Monday (UTC) of the week containing `date`, as `YYYY-MM-DD`.
 *
 * Every step derives its snapshot week from this one function so scrape, extract, and score always
 * agree on which week they are operating over, whichever day they happen to be invoked on.
 */
export function snapshotWeekFor(date: Date): string {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const offsetToMonday = (day.getUTCDay() + 6) % 7; // getUTCDay: 0 = Sunday
  day.setUTCDate(day.getUTCDate() - offsetToMonday);
  return day.toISOString().slice(0, 10);
}

/** Record the outcome of a pipeline execution. Never throws — status reporting must not fail the run. */
export async function recordPipelineRun(
  sql: Sql,
  status: "success" | "failed",
  recordCount: number | null,
  error: string | null
): Promise<void> {
  try {
    if (status === "success") {
      await sql`
        INSERT INTO pipeline_runs (pipeline, status, last_success_at, last_attempt_at, record_count, error)
        VALUES (${PIPELINE_NAME}, 'success', NOW(), NOW(), ${recordCount}, NULL)
        ON CONFLICT (pipeline) DO UPDATE SET
          status = 'success',
          last_success_at = NOW(),
          last_attempt_at = NOW(),
          record_count = ${recordCount},
          error = NULL
      `;
    } else {
      await sql`
        INSERT INTO pipeline_runs (pipeline, status, last_attempt_at, record_count, error)
        VALUES (${PIPELINE_NAME}, 'failed', NOW(), ${recordCount}, ${error})
        ON CONFLICT (pipeline) DO UPDATE SET
          status = 'failed',
          last_attempt_at = NOW(),
          error = ${error}
      `;
    }
  } catch (err) {
    console.warn("[pipeline-music] pipeline_runs upsert failed:", err);
  }
}

export interface ScrapeResult {
  snapshotWeek: string;
  scraped: number;
}

/**
 * Step 1 — scrape the Billboard Hot 100 into `music_top100_tracks` for the current snapshot week.
 *
 * Needs no Spotify credentials: Spotify IDs are resolved lazily by the extract step. Re-running is
 * safe; if a rank's title or artist changed, its `spotify_id` is cleared so extract re-resolves it.
 */
export async function runScrape(
  sql: Sql,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch
): Promise<ScrapeResult> {
  const snapshotWeek = snapshotWeekFor(now);
  const entries = await fetchHot100(fetchImpl);

  for (const entry of entries) {
    await sql`
      INSERT INTO music_top100_tracks (rank, title, artist, snapshot_week)
      VALUES (${entry.rank}, ${entry.title}, ${entry.artist}, ${snapshotWeek})
      ON CONFLICT (snapshot_week, rank) DO UPDATE SET
        title      = EXCLUDED.title,
        artist     = EXCLUDED.artist,
        spotify_id = CASE
          WHEN music_top100_tracks.title <> EXCLUDED.title
            OR music_top100_tracks.artist <> EXCLUDED.artist
          THEN NULL
          ELSE music_top100_tracks.spotify_id
        END
    `;
  }

  console.log(
    `[pipeline-music] scrape — ${entries.length} track(s) for snapshot week ${snapshotWeek}`
  );
  return { snapshotWeek, scraped: entries.length };
}

export interface ExtractResult {
  snapshotWeek: string;
  extracted: number;
  unresolved: number;
  failed: number;
}

type PendingTrack = { id: number; title: string; artist: string; spotifyId: string | null };

/**
 * Step 2 — resolve each scraped track on Spotify and store its extracted features.
 *
 * Only tracks without a features row for the week are processed, so the step is resumable and
 * cheap to re-run. A single track failing (no Spotify match, missing audio analysis) is counted
 * and skipped rather than failing the whole batch.
 */
export async function runExtract(
  sql: Sql,
  spotify: SpotifyClient,
  now: Date = new Date(),
  limit: number = EXTRACT_BATCH_LIMIT
): Promise<ExtractResult> {
  const snapshotWeek = snapshotWeekFor(now);

  const rows = await sql`
    SELECT t.id, t.title, t.artist, t.spotify_id
    FROM music_top100_tracks t
    LEFT JOIN music_track_features f
      ON f.track_id = t.id AND f.snapshot_week = ${snapshotWeek}
    WHERE t.snapshot_week = ${snapshotWeek}
      AND f.id IS NULL
    ORDER BY t.rank
    LIMIT ${limit}
  `;

  const pending: PendingTrack[] = rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title),
    artist: String(row.artist),
    spotifyId: row.spotify_id === null ? null : String(row.spotify_id),
  }));

  let extracted = 0;
  let unresolved = 0;
  let failed = 0;
  const limiter = pLimit(EXTRACT_CONCURRENCY);

  await Promise.all(
    pending.map((track) =>
      limiter(async () => {
        try {
          let spotifyId = track.spotifyId;

          if (!spotifyId) {
            const matches = await spotify.searchTrack(`${track.title} ${track.artist}`);
            spotifyId = matches[0]?.id ?? null;

            if (!spotifyId) {
              unresolved++;
              console.warn(
                `[pipeline-music] no Spotify match for "${track.title}" — ${track.artist}`
              );
              return;
            }

            await sql`
              UPDATE music_top100_tracks SET spotify_id = ${spotifyId} WHERE id = ${track.id}
            `;
          }

          const { audioFeatures, sections } = await spotify.getTrackFeatures(spotifyId);
          const features = extractFeatures(audioFeatures, sections);

          await sql`
            INSERT INTO music_track_features
              (track_id, snapshot_week, key_mode, bpm_range, song_structure, chord_flavor)
            VALUES
              (${track.id}, ${snapshotWeek}, ${features.key_mode}, ${features.bpm_range},
               ${features.song_structure}, ${features.chord_flavor})
            ON CONFLICT (track_id, snapshot_week) DO UPDATE SET
              key_mode       = EXCLUDED.key_mode,
              bpm_range      = EXCLUDED.bpm_range,
              song_structure = EXCLUDED.song_structure,
              chord_flavor   = EXCLUDED.chord_flavor
          `;
          extracted++;
        } catch (err) {
          failed++;
          console.error(
            `[pipeline-music] extract failed for track id=${track.id}:`,
            err instanceof Error ? err.message : String(err)
          );
        }
      })
    )
  );

  console.log(
    `[pipeline-music] extract — ${extracted} extracted, ${unresolved} unresolved, ${failed} failed (week ${snapshotWeek})`
  );
  return { snapshotWeek, extracted, unresolved, failed };
}

export interface ScoreResult {
  snapshotWeek: string;
  tracksScored: number;
  scoreCount: number;
}

/**
 * Step 3 — recompute the hot-to-indie rating for every feature value in the week's pool.
 *
 * Scores are upserted and then pruned, rather than deleted and re-inserted, so readers never
 * observe a snapshot week with zero scores mid-run.
 */
export async function runScore(sql: Sql, now: Date = new Date()): Promise<ScoreResult> {
  const snapshotWeek = snapshotWeekFor(now);

  const rows = await sql`
    SELECT key_mode, bpm_range, song_structure, chord_flavor
    FROM music_track_features
    WHERE snapshot_week = ${snapshotWeek}
  `;

  const pool: ExtractedFeatures[] = rows.map((row) => ({
    key_mode: (row.key_mode ?? "") as string,
    bpm_range: (row.bpm_range ?? "") as string,
    song_structure: row.song_structure as ExtractedFeatures["song_structure"],
    chord_flavor: row.chord_flavor as ExtractedFeatures["chord_flavor"],
  }));

  const scores: FeatureScore[] = scoreFeatures(pool);

  for (const score of scores) {
    await sql`
      INSERT INTO music_feature_scores
        (snapshot_week, feature_name, feature_value, count, rating)
      VALUES
        (${snapshotWeek}, ${score.feature_name}, ${score.feature_value}, ${score.count}, ${score.rating})
      ON CONFLICT (snapshot_week, feature_name, feature_value) DO UPDATE SET
        count  = EXCLUDED.count,
        rating = EXCLUDED.rating
    `;
  }

  // Drop feature values that no longer appear in this week's pool.
  const liveKeys = scores.map((s) => `${s.feature_name}|${s.feature_value}`);
  if (liveKeys.length > 0) {
    await sql`
      DELETE FROM music_feature_scores
      WHERE snapshot_week = ${snapshotWeek}
        AND feature_name = ANY(${[...FEATURE_NAMES]}::text[])
        AND (feature_name || '|' || feature_value) <> ALL(${liveKeys}::text[])
    `;
  }

  console.log(
    `[pipeline-music] score — ${scores.length} feature value(s) across ${pool.length} track(s) (week ${snapshotWeek})`
  );
  return { snapshotWeek, tracksScored: pool.length, scoreCount: scores.length };
}
