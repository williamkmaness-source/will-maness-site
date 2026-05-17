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
} from "../src/lib/boston-311";

// Raw row shape for case-level upserts (superset of the existing RawRow type).
type RawCaseRow = {
  case_enquiry_id?: string | null;
  neighborhood?: string | null;
  reason?: string | null;
  subject?: string | null;
  open_dt?: string | null;
  closed_dt?: string | null;
  on_time?: string | null;
  sla_target_dt?: string | null;
};

const MAX_RETRIES = 3;

// Fetches cases where open_dt or closed_dt falls within [startDate, endDate].
// Selects the full field set needed for case_events upserts.
async function fetchCasesInWindow(
  resourceId: string,
  startDate: string,
  endDate: string
): Promise<RawCaseRow[]> {
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
  // The 2-day buffer handles late-closing cases that may close after their open_dt window.
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

  console.log(`Upserting ${allRows.length} cases to case_events...`);

  let upserted = 0;
  for (const r of allRows) {
    if (!r.case_enquiry_id || !r.neighborhood?.trim() || !r.open_dt) continue;

    const openDate = r.open_dt.slice(0, 10);
    const closeDate = r.closed_dt ? r.closed_dt.slice(0, 10) : null;

    let daysToClose: number | null = null;
    if (r.closed_dt && r.open_dt) {
      const diff = new Date(r.closed_dt).getTime() - new Date(r.open_dt).getTime();
      if (diff >= 0) daysToClose = Math.round((diff / 86400000) * 100) / 100;
    }

    let slaDays: number | null = null;
    if (r.sla_target_dt && r.open_dt) {
      const diff = new Date(r.sla_target_dt).getTime() - new Date(r.open_dt).getTime();
      if (diff >= 0) slaDays = Math.round((diff / 86400000) * 100) / 100;
    }

    const onTime =
      r.on_time === "ONTIME" ? true : r.on_time === "OVERDUE" ? false : null;

    await sql`
      INSERT INTO case_events (
        case_id, neighborhood, request_type, department,
        open_date, close_date, days_to_close, on_time, sla_days
      ) VALUES (
        ${r.case_enquiry_id},
        ${r.neighborhood.trim()},
        ${r.reason ?? "Unknown"},
        ${r.subject ?? null},
        ${openDate},
        ${closeDate},
        ${daysToClose},
        ${onTime},
        ${slaDays}
      )
      ON CONFLICT (case_id) DO UPDATE SET
        neighborhood  = EXCLUDED.neighborhood,
        request_type  = EXCLUDED.request_type,
        department    = EXCLUDED.department,
        open_date     = EXCLUDED.open_date,
        close_date    = EXCLUDED.close_date,
        days_to_close = EXCLUDED.days_to_close,
        on_time       = EXCLUDED.on_time,
        sla_days      = EXCLUDED.sla_days
    `;
    upserted++;
  }

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
