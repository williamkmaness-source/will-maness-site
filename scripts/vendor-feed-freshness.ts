// vendor-feed-freshness.ts — per-vendor scrape freshness diagnostic
// Run: pnpm vendor-feed:freshness
//
// Prints one row per configured vendor showing last entity date, last scrape
// timestamp, scrape status, and raw page count. Dead/stale vendors (no entity
// in the last 30 days) are sorted to the top and flagged with ⚠.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { loadCompanies } from "../src/lib/vendor-feed/config";

config({ path: ".env.local" });

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Set POSTGRES_URL_NON_POOLING or POSTGRES_URL in .env.local");
  process.exit(1);
}

const sql = neon(connectionString);

interface RawPageRow {
  company: string;
  page_count: number;
  last_scrape: string | null;
  latest_status: string | null;
  latest_error: string | null;
}

interface EntityRow {
  company: string;
  last_entity_date: string | null;
}

async function main(): Promise<void> {
  const companies = loadCompanies();
  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rawRows = (await sql`
    SELECT
      company,
      COUNT(*)::int                                       AS page_count,
      MAX(scraped_at)::text                               AS last_scrape,
      (ARRAY_AGG(status       ORDER BY scraped_at DESC))[1] AS latest_status,
      (ARRAY_AGG(error_message ORDER BY scraped_at DESC))[1] AS latest_error
    FROM vf_raw_pages
    GROUP BY company
  `) as unknown as RawPageRow[];

  const rawMap = new Map(rawRows.map((r) => [r.company, r]));

  const entityRows = (await sql`
    SELECT company, MAX(entity_date)::text AS last_entity_date
    FROM (
      SELECT company, release_date  AS entity_date FROM vf_feature_launches    WHERE release_date   IS NOT NULL
      UNION ALL
      SELECT company, effective_date               FROM vf_pricing_changes      WHERE effective_date IS NOT NULL
      UNION ALL
      SELECT company, announced_date               FROM vf_partnerships         WHERE announced_date IS NOT NULL
      UNION ALL
      SELECT company, announced_date               FROM vf_architectural_shifts WHERE announced_date IS NOT NULL
    ) e
    GROUP BY company
  `) as unknown as EntityRow[];

  const entityMap = new Map(entityRows.map((r) => [r.company, r.last_entity_date]));

  type DiagRow = {
    name: string;
    lastEntityDate: string | null;
    lastScrape: string | null;
    latestStatus: string | null;
    latestError: string | null;
    pageCount: number;
    isDead: boolean;
  };

  const rows: DiagRow[] = companies.map((company) => {
    const raw = rawMap.get(company.name);
    const lastEntityDate = entityMap.get(company.name) ?? null;
    const isDead =
      !lastEntityDate || new Date(lastEntityDate) < THIRTY_DAYS_AGO;
    return {
      name: company.name,
      lastEntityDate,
      lastScrape: raw?.last_scrape ?? null,
      latestStatus: raw?.latest_status ?? null,
      latestError: raw?.latest_error ?? null,
      pageCount: raw?.page_count ?? 0,
      isDead,
    };
  });

  // Dead/stale vendors first, then most-recently-active
  rows.sort((a, b) => {
    if (a.isDead !== b.isDead) return a.isDead ? -1 : 1;
    const aMs = a.lastEntityDate ? new Date(a.lastEntityDate).getTime() : 0;
    const bMs = b.lastEntityDate ? new Date(b.lastEntityDate).getTime() : 0;
    return bMs - aMs;
  });

  const W = { name: 18, entity: 12, scrape: 12, status: 10, pages: 6 };
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
  const total = W.name + W.entity + W.scrape + W.status + W.pages;

  console.log();
  console.log(
    pad("COMPANY", W.name) +
      pad("LAST ENTITY", W.entity) +
      pad("LAST SCRAPE", W.scrape) +
      pad("STATUS", W.status) +
      pad("PAGES", W.pages)
  );
  console.log("-".repeat(total));

  for (const row of rows) {
    const flag = row.isDead ? " ⚠" : "";
    const entityStr = row.lastEntityDate
      ? row.lastEntityDate.slice(0, 10)
      : "NONE";
    const scrapeStr = row.lastScrape ? row.lastScrape.slice(0, 10) : "NEVER";
    const statusStr = row.latestStatus ?? "no-rows";
    const pagesStr = String(row.pageCount);
    const errorHint = row.latestError
      ? `  [${row.latestError.slice(0, 60)}]`
      : "";

    console.log(
      pad(row.name + flag, W.name) +
        pad(entityStr, W.entity) +
        pad(scrapeStr, W.scrape) +
        pad(statusStr, W.status) +
        pad(pagesStr, W.pages) +
        errorHint
    );
  }

  const deadCount = rows.filter((r) => r.isDead).length;
  console.log();
  console.log(
    `${deadCount} of ${companies.length} vendors have no entity in the last 30 days`
  );
  if (deadCount > 0) console.log("⚠ = dead/stale");
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
