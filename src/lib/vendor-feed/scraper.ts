import { createHash } from "crypto";
import pLimit from "p-limit";
import type { Company } from "./config";
import { companies } from "./config";
import { upsertRawPage, type UpsertAction } from "./db";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function getSourceUrls(company: Company): string[] {
  const urls: string[] = [company.blog_url];
  if (company.github_releases_url) urls.push(company.github_releases_url);
  return urls;
}

/**
 * Parse article URLs from RSS 2.0 XML, filtering to items published within
 * `cutoffDays` days of the reference date (defaults: 90 days, now).
 */
export function parseRssArticleUrls(
  xml: string,
  cutoffDays = 90,
  referenceDate: Date = new Date()
): string[] {
  const cutoff = new Date(referenceDate.getTime() - cutoffDays * 24 * 60 * 60 * 1000);
  const urls: string[] = [];

  // Match each <item>…</item> block (greedy-safe with non-greedy [\s\S]*?)
  const itemPattern = /<item(?:[^>]*)>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(xml)) !== null) {
    const item = match[1];

    // Apply 90-day filter when pubDate is present and parseable
    const pubDateMatch = /<pubDate>([^<]+)<\/pubDate>/i.exec(item);
    if (pubDateMatch) {
      const pubDate = new Date(pubDateMatch[1].trim());
      if (!isNaN(pubDate.getTime()) && pubDate < cutoff) continue;
    }

    // RSS 2.0: <link>URL</link>  — strip CDATA if present
    const rssLink = /<link>(?:<!\[CDATA\[)?(https?[^<\]]+?)(?:\]\]>)?<\/link>/i.exec(item);
    if (rssLink) {
      urls.push(rssLink[1].trim());
      continue;
    }

    // Atom-in-RSS: <link href="URL" .../>
    const atomLink = /<link[^>]+href="(https?[^"]+)"/i.exec(item);
    if (atomLink) {
      urls.push(atomLink[1].trim());
    }
  }

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
type LimitFn = ReturnType<typeof pLimit>;

async function upsertPage(
  sql: NeonQueryFunction<false, false>,
  upsert: UpsertFn,
  company: string,
  url: string,
  content: string
): Promise<ScrapeResult> {
  const contentHash = hashContent(content);
  const { action } = await upsert(sql, { company, sourceUrl: url, contentHash, rawContent: content });
  return { url, action };
}

export async function scrapeCompany(
  company: Company,
  upsert: UpsertFn,
  sql: NeonQueryFunction<false, false>,
  fetch: FetchFn = fetchUrl,
  limit: LimitFn = pLimit(5)
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  if (company.rss_url) {
    // RSS path: discover article URLs from the feed, then fetch each concurrently
    try {
      const rssXml = await fetch(company.rss_url);
      const articleUrls = parseRssArticleUrls(rssXml);
      const articleResults = await Promise.all(
        articleUrls.map((url) =>
          limit(async () => {
            try {
              const content = await fetch(url);
              return await upsertPage(sql, upsert, company.name, url, content);
            } catch (err) {
              const error = err instanceof Error ? err.message : String(err);
              console.error(`[scraper] error fetching ${url}: ${error}`);
              return { url, action: "error" as const, error };
            }
          })
        )
      );
      results.push(...articleResults);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[scraper] error fetching RSS ${company.rss_url}: ${error}`);
      results.push({ url: company.rss_url, action: "error", error });
    }
  } else {
    // Fallback path: fetch blog index as a single page
    try {
      const content = await fetch(company.blog_url);
      results.push(await upsertPage(sql, upsert, company.name, company.blog_url, content));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[scraper] error fetching ${company.blog_url}: ${error}`);
      results.push({ url: company.blog_url, action: "error", error });
    }
  }

  // GitHub releases: always fetch directly (unchanged)
  if (company.github_releases_url) {
    try {
      const content = await fetch(company.github_releases_url);
      results.push(await upsertPage(sql, upsert, company.name, company.github_releases_url, content));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[scraper] error fetching ${company.github_releases_url}: ${error}`);
      results.push({ url: company.github_releases_url, action: "error", error });
    }
  }

  return results;
}

export async function runScraper(
  sql: NeonQueryFunction<false, false>,
  fetch: FetchFn = fetchUrl
): Promise<void> {
  // One shared limit instance caps concurrent article fetches across all companies
  const limit = pLimit(5);
  let inserted = 0, updated = 0, skipped = 0, errors = 0;

  for (const company of companies) {
    const results = await scrapeCompany(company, upsertRawPage, sql, fetch, limit);
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
