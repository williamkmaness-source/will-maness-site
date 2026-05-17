// pipeline-311.ts — Nightly 311 data pipeline. Fetches CKAN, aggregates, upserts to Postgres.
// Run via: pnpm tsx scripts/pipeline-311.ts
// Skips .env.local loading gracefully if vars are already set (CI sets them directly).

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

// Load .env.local for local dev; in CI env vars are set directly. Missing file is OK.
config({ path: ".env.local" });

// Relative imports to avoid tsconfig path alias issues in script context.
import {
  fetchWindow,
  computeWindow,
  mergeWindows,
} from "../src/lib/boston-311";

// Minimal types copied inline (script cannot use @/ alias).
const ALL_CATEGORIES = "All categories" as const;

type NeighborhoodStat = {
  neighborhood: string;
  medianDays: number;
  onTimeRate: number;
  count: number;
  openedCount: number;
  closedCount: number;
};

type RequestTypeMetrics = {
  requestType: string;
  equityGap: number | null;
  cityMedian: number | null;
  totalCases: number;
  neighborhoods: NeighborhoodStat[];
  yoyEquityGap: number | null;
};

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    throw new Error("POSTGRES_URL_NON_POOLING is not set");
  }

  const sql = neon(connectionString);

  // Compute window dates matching the API route logic.
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const priorEnd = new Date(windowEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
  const priorStart = new Date(windowStart.getTime() - 365 * 24 * 60 * 60 * 1000);

  const snapshotDate = windowEnd.toISOString().slice(0, 10);

  console.log(`Fetching data for window ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

  const [currentResult, priorResult] = await Promise.all([
    fetchWindow(windowStart, windowEnd),
    fetchWindow(priorStart, priorEnd),
  ]);

  const currentWindow = computeWindow(
    currentResult.rows,
    windowStart.getTime(),
    windowEnd.getTime()
  );
  const priorWindow = computeWindow(
    priorResult.rows,
    priorStart.getTime(),
    priorEnd.getTime()
  );

  const requestTypes: RequestTypeMetrics[] = mergeWindows(currentWindow, priorWindow);

  // Build rows for upsert. Type-level fields are duplicated across neighborhood rows
  // for simple reconstruction on read.
  type UpsertRow = {
    snapshotDate: string;
    neighborhood: string;
    requestType: string;
    windowStart: string;
    windowEnd: string;
    medianDays: number | null;
    onTimeRate: number;
    caseCount: number;
    openedCount: number;
    closedCount: number;
    cityMedian: number | null;
    equityGap: number | null;
    totalCases: number;
    yoyEquityGap: number | null;
  };

  const rows: UpsertRow[] = [];

  for (const rt of requestTypes) {
    for (const n of rt.neighborhoods) {
      rows.push({
        snapshotDate,
        neighborhood: n.neighborhood,
        requestType: rt.requestType,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        medianDays: n.medianDays === 0 && n.count === 0 ? null : n.medianDays,
        onTimeRate: n.onTimeRate,
        caseCount: n.count,
        openedCount: n.openedCount,
        closedCount: n.closedCount,
        cityMedian: rt.cityMedian,
        equityGap: rt.equityGap,
        totalCases: rt.totalCases,
        yoyEquityGap: rt.yoyEquityGap,
      });
    }
  }

  console.log(`Upserting ${rows.length} rows for snapshot_date=${snapshotDate}...`);

  // Upsert in batches to stay within Neon's parameter limit.
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (const r of batch) {
      await sql`
        INSERT INTO snapshots (
          snapshot_date, neighborhood, request_type,
          window_start, window_end,
          median_days, on_time_rate, case_count,
          opened_count, closed_count,
          city_median, equity_gap, total_cases, yoy_equity_gap
        ) VALUES (
          ${r.snapshotDate}, ${r.neighborhood}, ${r.requestType},
          ${r.windowStart}, ${r.windowEnd},
          ${r.medianDays}, ${r.onTimeRate}, ${r.caseCount},
          ${r.openedCount}, ${r.closedCount},
          ${r.cityMedian}, ${r.equityGap}, ${r.totalCases}, ${r.yoyEquityGap}
        )
        ON CONFLICT (snapshot_date, neighborhood, request_type) DO UPDATE SET
          window_start   = EXCLUDED.window_start,
          window_end     = EXCLUDED.window_end,
          median_days    = EXCLUDED.median_days,
          on_time_rate   = EXCLUDED.on_time_rate,
          case_count     = EXCLUDED.case_count,
          opened_count   = EXCLUDED.opened_count,
          closed_count   = EXCLUDED.closed_count,
          city_median    = EXCLUDED.city_median,
          equity_gap     = EXCLUDED.equity_gap,
          total_cases    = EXCLUDED.total_cases,
          yoy_equity_gap = EXCLUDED.yoy_equity_gap
      `;
    }
  }

  console.log(`Pipeline complete. Upserted ${rows.length} records.`);

  // Suppress unused-import warning from the ALL_CATEGORIES copy.
  void ALL_CATEGORIES;
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
