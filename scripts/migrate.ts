// migrate.ts — Creates the snapshots table in Postgres for the 311 nightly pipeline.
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

  console.log("Migration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
