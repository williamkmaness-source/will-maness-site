// backfill-311.ts — One-time historical backfill of case_events from CKAN (2024-01-01 → today).
// Run: pnpm tsx scripts/backfill-311.ts
// Safe to re-run: upserts on case_id, so re-running updates existing rows rather than duplicating.
// Expects POSTGRES_URL_NON_POOLING in env (load .env.local for local dev; CI sets it directly).

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
const BACKFILL_START = "2024-01-01";

async function fetchCaseEvents(
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
      const timer = setTimeout(() => controller.abort(), 30_000);
      try {
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`CKAN ${res.status}: ${res.statusText}`);
        json = (await res.json()) as CKANResp;
        lastError = undefined;
        break;
      } catch (err) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
        }
      }
    }

    if (!json?.success || !json.result) {
      throw new Error(
        `CKAN error for resource ${resourceId}: ${json?.error?.message ?? lastError?.message ?? "unknown"}`
      );
    }

    rows.push(...json.result.records);
    const fetched = json.result.records.length;
    if (fetched > 0) {
      process.stdout.write(`\r  ${rows.length} rows fetched (offset ${offset})...`);
    }
    if (fetched < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

function computeElapsed(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("POSTGRES_URL_NON_POOLING is not set");

  const sql = neon(connectionString);
  const backfillEnd = toDateStr(new Date());

  console.log(`Backfilling case_events: ${BACKFILL_START} → ${backfillEnd}`);
  console.log(`Resources: ${YEAR_RESOURCES.map(([y]) => y).join(", ")}\n`);

  let totalProcessed = 0;
  const start = Date.now();

  for (const [year, resourceId] of YEAR_RESOURCES) {
    console.log(`[${year}] Fetching resource ${resourceId}...`);
    const rows = await fetchCaseEvents(resourceId, BACKFILL_START, backfillEnd);
    console.log(`\n[${year}] Fetched ${rows.length} rows. Preparing upsert...`);

    const records = rows
      .map(prepareCaseEvent)
      .filter((r): r is NonNullable<typeof r> => r !== null);

    console.log(`[${year}] ${records.length} valid records. Batch upserting...`);
    const upserted = await batchUpsertCaseEvents(sql as any, records);

    totalProcessed += upserted;
    console.log(`[${year}] Done — ${upserted} rows upserted.`);
  }

  const elapsed = computeElapsed(Date.now() - start);
  console.log(`\nBackfill complete. ${totalProcessed} total rows in ${elapsed}.`);
  console.log("Run the pipeline to rebuild request_type_meta from the new data.");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
