// migrate-311-weekly-metrics.ts — Creates the department_weekly_metrics table
// for the staffing dashboard. Aggregates case_events into ISO weeks per department.
// Safe to re-run (CREATE TABLE IF NOT EXISTS, INSERT ON CONFLICT DO NOTHING).
// Run: pnpm tsx scripts/migrate-311-weekly-metrics.ts

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    throw new Error("POSTGRES_URL_NON_POOLING is not set");
  }

  const sql = neon(connectionString);

  console.log("Creating department_weekly_metrics table...");
  await sql`
    CREATE TABLE IF NOT EXISTS department_weekly_metrics (
      week        DATE    NOT NULL,
      department  TEXT    NOT NULL,
      opened      INT    NOT NULL DEFAULT 0,
      closed      INT    NOT NULL DEFAULT 0,
      median_days NUMERIC,
      PRIMARY KEY (week, department)
    )
  `;

  console.log("Backfilling weekly metrics from case_events...");
  await sql`
    INSERT INTO department_weekly_metrics (week, department, opened, closed, median_days)
    SELECT
      DATE_TRUNC('week', ce.open_date)::date                           AS week,
      rtm.department,
      COUNT(*) FILTER (WHERE ce.open_date IS NOT NULL)                 AS opened,
      COUNT(*) FILTER (WHERE ce.close_date IS NOT NULL)                AS closed,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ce.days_to_close)
        FILTER (WHERE ce.days_to_close IS NOT NULL)                    AS median_days
    FROM case_events ce
    JOIN request_type_meta rtm
      ON rtm.request_type = ce.request_type
      AND rtm.include_in_dashboard = true
    WHERE ce.open_date IS NOT NULL
    GROUP BY DATE_TRUNC('week', ce.open_date)::date, rtm.department
    ON CONFLICT (week, department) DO UPDATE SET
      opened      = EXCLUDED.opened,
      closed      = EXCLUDED.closed,
      median_days = EXCLUDED.median_days
  `;

  const rows = await sql`
    SELECT COUNT(DISTINCT department) AS depts, COUNT(*) AS rows,
           MIN(week) AS earliest, MAX(week) AS latest
    FROM department_weekly_metrics
  `;
  const r = rows[0] as any;
  console.log(`Backfilled ${r.rows} rows across ${r.depts} departments (${r.earliest} → ${r.latest}).`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
