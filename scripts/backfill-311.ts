// backfill-311.ts — One-time historical backfill of case_events from CKAN (2024-01-01 → today).
// Run: pnpm tsx scripts/backfill-311.ts
// Safe to re-run: upserts on case_id, so re-running updates existing rows rather than duplicating.
// Expects POSTGRES_URL_NON_POOLING in env (load .env.local for local dev; CI sets it directly).

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

import { CKAN_SQL_URL, PAGE_SIZE, YEAR_RESOURCES, toDateStr } from "../src/lib/boston-311";

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
const BACKFILL_START = "2024-01-01";

async function fetchCaseEvents(
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
    console.log(`\n[${year}] Fetched ${rows.length} rows. Upserting...`);

    let upserted = 0;
    const BATCH = 200;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);

      for (const r of batch) {
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

      if (i % 2000 === 0 && i > 0) {
        process.stdout.write(`\r  ${upserted}/${rows.length} upserted...`);
      }
    }

    totalProcessed += upserted;
    console.log(`\n[${year}] Done — ${upserted} rows upserted.`);
  }

  const elapsed = computeElapsed(Date.now() - start);
  console.log(`\nBackfill complete. ${totalProcessed} total rows in ${elapsed}.`);
  console.log("Run the pipeline to rebuild request_type_meta from the new data.");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
