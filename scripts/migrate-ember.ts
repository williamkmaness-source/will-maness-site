// migrate-ember.ts — Creates the Postgres schema for the EmberBrief fire monitoring dashboard.
// Safe to re-run (all statements use IF NOT EXISTS).
// Uses POSTGRES_URL_NON_POOLING (direct connection required for DDL).

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("POSTGRES_URL_NON_POOLING is not set");

  const sql = neon(connectionString);

  // One row per satellite-detected fire cluster per ingest run.
  // risk_score, tier, weather, briefing are populated by later pipeline slices (#96–#98).
  await sql`
    CREATE TABLE IF NOT EXISTS ember_fire_clusters (
      id                    SERIAL      PRIMARY KEY,
      lat                   numeric     NOT NULL,
      lng                   numeric     NOT NULL,
      frp                   numeric     NOT NULL,
      detection_count       integer     NOT NULL DEFAULT 1,
      detected_at           timestamptz NOT NULL,
      risk_score            numeric,
      tier                  text,
      weather               jsonb,
      briefing              text,
      briefing_generated_at timestamptz,
      created_at            timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ember_clusters_detected_at
      ON ember_fire_clusters (detected_at DESC)
  `;

  // Single upserted row per county — represents current observed conditions.
  // Populated by the weather pipeline slice (#96).
  await sql`
    CREATE TABLE IF NOT EXISTS ember_county_conditions (
      id              SERIAL      PRIMARY KEY,
      county          text        NOT NULL DEFAULT 'Shasta County',
      wind_speed      numeric,
      wind_direction  text,
      humidity        numeric,
      temperature     numeric,
      red_flag        boolean     NOT NULL DEFAULT false,
      forecast        jsonb,
      observed_at     timestamptz NOT NULL,
      created_at      timestamptz NOT NULL DEFAULT now(),
      UNIQUE (county)
    )
  `;

  console.log("✓ ember schema up to date");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
