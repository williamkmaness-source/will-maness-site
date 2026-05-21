// migrate.ts — Creates/updates the Postgres schema for the 311 nightly pipeline.
// Safe to re-run (all statements use IF NOT EXISTS / IF NOT EXISTS indexes).
// Uses POSTGRES_URL_NON_POOLING (direct connection required for DDL).
// Load .env.local via dotenv for local runs; in CI, env vars are set directly.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    throw new Error("POSTGRES_URL_NON_POOLING is not set");
  }

  const sql = neon(connectionString);

  // Legacy pre-aggregated snapshot table. Retained for API fallback until #54 ships.
  await sql`
    CREATE TABLE IF NOT EXISTS snapshots (
      snapshot_date   date        NOT NULL,
      neighborhood    text        NOT NULL,
      request_type    text        NOT NULL,
      window_start    timestamptz NOT NULL,
      window_end      timestamptz NOT NULL,
      median_days     numeric,
      on_time_rate    numeric,
      case_count      integer     NOT NULL DEFAULT 0,
      opened_count    integer     NOT NULL DEFAULT 0,
      closed_count    integer     NOT NULL DEFAULT 0,
      city_median     numeric,
      equity_gap      numeric,
      total_cases     integer     NOT NULL DEFAULT 0,
      yoy_equity_gap  numeric,
      PRIMARY KEY (snapshot_date, neighborhood, request_type)
    )
  `;

  // Case-level event store — one row per 311 case. Enables exact median computation
  // at any time granularity without pre-aggregation. Populated by backfill-311.ts
  // (historical) and the daily pipeline upsert (incremental).
  await sql`
    CREATE TABLE IF NOT EXISTS case_events (
      case_id        text    PRIMARY KEY,
      neighborhood   text    NOT NULL,
      request_type   text    NOT NULL,
      department     text,
      open_date      date    NOT NULL,
      close_date     date,
      days_to_close  numeric,
      on_time        boolean,
      sla_days       numeric
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_ce_open_date ON case_events (open_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ce_close_date ON case_events (close_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ce_neighborhood_rt ON case_events (neighborhood, request_type)`;

  // Pipeline health log — one row per pipeline, upserted on every cron/workflow run.
  // pipeline values: '311' | 'chess' | 'vendor-feed'
  // status values:   'success' | 'failed' | 'running'
  await sql`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id               SERIAL      PRIMARY KEY,
      pipeline         TEXT        NOT NULL UNIQUE,
      status           TEXT        NOT NULL,
      last_success_at  TIMESTAMPTZ,
      last_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      record_count     INTEGER,
      error            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline_attempt
      ON pipeline_runs (pipeline, last_attempt_at DESC)
  `;

  // Derived lookup: mode department and median SLA per request type. Rebuilt nightly
  // by the pipeline after the case_events upsert. Used by the API for department/slaTarget fields.
  await sql`
    CREATE TABLE IF NOT EXISTS request_type_meta (
      request_type   text    PRIMARY KEY,
      department     text,
      sla_days       numeric,
      last_updated   date    NOT NULL
    )
  `;

  console.log("Migration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
