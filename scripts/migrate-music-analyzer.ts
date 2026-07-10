// migrate-music-analyzer.ts — Creates the Postgres schema for the music pattern analyzer (issue #213).
// Safe to re-run (all statements use IF NOT EXISTS).
// Uses POSTGRES_URL_NON_POOLING (direct connection required for DDL).

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("POSTGRES_URL_NON_POOLING is not set");

  const sql = neon(connectionString);

  // Weekly Billboard Hot 100 snapshot.
  await sql`
    CREATE TABLE IF NOT EXISTS music_top100_tracks (
      id             bigserial   PRIMARY KEY,
      rank           integer     NOT NULL,
      title          text        NOT NULL,
      artist         text        NOT NULL,
      spotify_id     text,
      snapshot_week  date        NOT NULL,
      created_at     timestamptz NOT NULL DEFAULT now(),
      UNIQUE (snapshot_week, rank)
    )
  `;

  // Extracted features per track per week.
  await sql`
    CREATE TABLE IF NOT EXISTS music_track_features (
      id             bigserial   PRIMARY KEY,
      track_id       bigint      NOT NULL REFERENCES music_top100_tracks(id),
      snapshot_week  date        NOT NULL,
      key_mode       text,
      bpm_range      text,
      song_structure text,
      chord_flavor   text,
      created_at     timestamptz NOT NULL DEFAULT now(),
      UNIQUE (track_id, snapshot_week)
    )
  `;

  // Precomputed hot-to-indie rating per feature value per snapshot week.
  await sql`
    CREATE TABLE IF NOT EXISTS music_feature_scores (
      id             bigserial   PRIMARY KEY,
      snapshot_week  date        NOT NULL,
      feature_name   text        NOT NULL,
      feature_value  text        NOT NULL,
      count          integer     NOT NULL,
      rating         text        NOT NULL,
      created_at     timestamptz NOT NULL DEFAULT now(),
      UNIQUE (snapshot_week, feature_name, feature_value)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_music_feature_scores_week
      ON music_feature_scores (snapshot_week)
  `;

  console.log("✓ music-analyzer schema up to date");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
