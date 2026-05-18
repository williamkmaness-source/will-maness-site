import { createHash } from "crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { companies, type Company } from "./config";
import { upsertRawPage, type UpsertAction } from "./db";

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function getSourceUrls(company: Company): string[] {
  const urls: string[] = [company.rss_url ?? company.blog_url];
  if (company.github_releases_url) urls.push(company.github_releases_url);
  return urls;
}

export async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "vendor-feed-bot/1.0 (github.com/williamkmaness-source/will-maness-site)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

export interface ScrapeResult {
  url: string;
  action: UpsertAction | "error";
  error?: string;
}

type FetchFn = (url: string) => Promise<string>;
type UpsertFn = typeof upsertRawPage;

export async function scrapeCompany(
  company: Company,
  upsert: UpsertFn,
  sql: NeonQueryFunction<false, false>,
  fetch: FetchFn = fetchUrl
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  for (const url of getSourceUrls(company)) {
    try {
      const content = await fetch(url);
      const contentHash = hashContent(content);
      const { action } = await upsert(sql, {
        company: company.name,
        sourceUrl: url,
        contentHash,
        rawContent: content,
      });
      results.push({ url, action });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[scraper] error fetching ${url}: ${error}`);
      results.push({ url, action: "error", error });
    }
  }

  return results;
}

export async function runScraper(
  sql: NeonQueryFunction<false, false>,
  fetch: FetchFn = fetchUrl
): Promise<void> {
  let inserted = 0, updated = 0, skipped = 0, errors = 0;

  for (const company of companies) {
    const results = await scrapeCompany(company, upsertRawPage, sql, fetch);
    for (const r of results) {
      if (r.action === "inserted") inserted++;
      else if (r.action === "updated") updated++;
      else if (r.action === "skipped") skipped++;
      else errors++;
    }
  }

  console.log(
    `[scraper] done — inserted: ${inserted}, updated: ${updated}, skipped: ${skipped}, errors: ${errors}`
  );
}
