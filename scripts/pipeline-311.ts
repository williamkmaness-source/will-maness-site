// pipeline-311.ts — Nightly 311 data pipeline.
// Fetches the last 2 days of cases from CKAN and upserts to case_events,
// then rebuilds request_type_meta from the full case_events table.
// Run via: pnpm tsx scripts/pipeline-311.ts

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

import {
  CKAN_SQL_URL,
  PAGE_SIZE,
  YEAR_RESOURCES,
  toDateStr,
  assertIsoDate,
  type RawCaseRow,
  prepareCaseEvent,
  batchUpsertCaseEvents,
} from "../src/lib/boston-311";

const MAX_RETRIES = 3;

async function fetchCasesInWindow(
  resourceId: string,
  startDate: string,
  endDate: string
): Promise<RawCaseRow[]> {
  assertIsoDate(startDate);
  assertIsoDate(endDate);

  const rows: RawCaseRow[] = [];
  let offset = 0;

  while (true) {
    const query = [
      `SELECT case_enquiry_id,neighborhood,reason,subject,open_dt,closed_dt,on_time,sla_target_dt`,
      `FROM "${resourceId}"`,
      `WHERE ((open_dt >= '${startDate}' AND open_dt <= '${endDate}')`,
      `OR (closed_dt >= '${startDate}' AND closed_dt <= '${endDate}'))`,
      `AND neighborhood IS NOT NULL`,
      `AND neighborhood != ''`,
      `AND case_enquiry_id IS NOT NULL`,
      `LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    ].join(" ");

    const url = `${CKAN_SQL_URL}?sql=${encodeURIComponent(query)}`;

    type CKANResp = {
      success: boolean;
      result?: { records: RawCaseRow[] };
      error?: { message?: string };
    };

    let json: CKANResp | undefined;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        clearTimeout(timer);
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`CKAN API responded ${res.status}: ${res.statusText}`);
        }
        if (!res.ok) throw new Error(`CKAN API responded ${res.status}: ${res.statusText}`);
        json = (await res.json()) as CKANResp;
        lastError = undefined;
        break;
      } catch (err) {
        clearTimeout(timer);
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.message.startsWith("CKAN API responded 4")) throw e;
        lastError = e;
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
        }
      }
    }

    if (!json?.success || !json.result) {
      throw new Error(
        `fetchCasesInWindow: all retries failed for resource ${resourceId}` +
          (lastError ? ` — ${lastError.message}` : "")
      );
    }

    rows.push(...json.result.records);
    if (json.result.records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    throw new Error("POSTGRES_URL_NON_POOLING is not set");
  }

  const sql = neon(connectionString);

  // Fetch the last 2 days to catch both newly-opened and recently-closed cases.
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 2 * 24 * 60 * 60 * 1000);
  const startDate = toDateStr(windowStart);
  const endDate = toDateStr(windowEnd);

  console.log(`Fetching cases for ${startDate} → ${endDate}...`);

  // Only fetch resources whose year overlaps the 2-day window.
  const startYear = windowStart.getFullYear();
  const endYear = windowEnd.getFullYear();
  const relevant = YEAR_RESOURCES.filter(
    ([year]) => year >= startYear && year <= endYear
  );

  const allRows: RawCaseRow[] = [];
  for (const [year, resourceId] of relevant) {
    console.log(`  Fetching year ${year} resource...`);
    const rows = await fetchCasesInWindow(resourceId, startDate, endDate);
    allRows.push(...rows);
    console.log(`  ${rows.length} cases from ${year}.`);
  }

  const records = allRows
    .map(prepareCaseEvent)
    .filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`Batch upserting ${records.length} cases to case_events...`);
  const upserted = await batchUpsertCaseEvents(sql as any, records);
  console.log(`case_events upsert complete: ${upserted} rows.`);

  // Rebuild request_type_meta from the full case_events table.
  // MODE() picks the most common department; PERCENTILE_CONT gives median SLA.
  console.log("Rebuilding request_type_meta...");
  await sql`
    INSERT INTO request_type_meta (request_type, department, sla_days, last_updated)
    SELECT
      request_type,
      MODE() WITHIN GROUP (ORDER BY department)                    AS department,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sla_days)        AS sla_days,
      CURRENT_DATE
    FROM case_events
    WHERE department IS NOT NULL
      AND sla_days IS NOT NULL
    GROUP BY request_type
    ON CONFLICT (request_type) DO UPDATE SET
      department   = EXCLUDED.department,
      sla_days     = EXCLUDED.sla_days,
      last_updated = EXCLUDED.last_updated
  `;

  console.log("Pipeline complete.");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
