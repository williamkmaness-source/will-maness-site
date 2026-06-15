import { createHash } from "crypto";
import pLimit from "p-limit";
import type { Company } from "./config";
import { companies } from "./config";
import { upsertRawPage, recordFeedError, type UpsertAction } from "./db";
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
 * Parse article URLs from RSS 2.0 or Atom XML, filtering to items/entries
 * published within `cutoffDays` days of the reference date (defaults: 90 days, now).
 *
 * RSS 2.0: matches <item> blocks, reads <pubDate> for the date filter.
 * Atom:    matches <entry> blocks, reads <published> (falling back to <updated>)
 *          for the date filter. Feed-level <updated> is never used as an entry date.
 */
export function parseRssArticleUrls(
  xml: string,
  cutoffDays = 90,
  referenceDate: Date = new Date()
): string[] {
  const cutoff = new Date(referenceDate.getTime() - cutoffDays * 24 * 60 * 60 * 1000);
  const urls: string[] = [];

  // Returns true if the block should be included: no parseable date (include by default),
  // or the first parseable date among the given tags is within the cutoff window.
  function isWithinCutoff(block: string, ...dateTags: string[]): boolean {
    for (const tag of dateTags) {
      const m = new RegExp(`<${tag}>([^<]+)</${tag}>`, "i").exec(block);
      if (m) {
        const d = new Date(m[1].trim());
        if (!isNaN(d.getTime())) return d >= cutoff;
      }
    }
    return true;
  }

  // Extracts the article URL from an <item> or <entry> block.
  // Tries RSS 2.0 <link>URL</link> first, then Atom <link href="URL"/>.
  function extractUrl(block: string): string | null {
    const rssLink = /<link>(?:<!\[CDATA\[)?(https?[^<\]]+?)(?:\]\]>)?<\/link>/i.exec(block);
    if (rssLink) return rssLink[1].trim();
    const atomLink = /<link[^>]+href="(https?[^"]+)"/i.exec(block);
    if (atomLink) return atomLink[1].trim();
    return null;
  }

  let match: RegExpExecArray | null;

  // RSS 2.0: <item> blocks — date tag: pubDate
  const itemPattern = /<item(?:[^>]*)>([\s\S]*?)<\/item>/gi;
  while ((match = itemPattern.exec(xml)) !== null) {
    if (!isWithinCutoff(match[1], "pubDate")) continue;
    const url = extractUrl(match[1]);
    if (url) urls.push(url);
  }

  // Atom: <entry> blocks — date tags: published (preferred), updated (fallback)
  const entryPattern = /<entry(?:[^>]*)>([\s\S]*?)<\/entry>/gi;
  while ((match = entryPattern.exec(xml)) !== null) {
    if (!isWithinCutoff(match[1], "published", "updated")) continue;
    const url = extractUrl(match[1]);
    if (url) urls.push(url);
  }

  return urls;
}

/**
 * Parse article URLs from an XML sitemap, optionally filtering to paths that
 * start with `pathFilter` (e.g. "/blog/"). Only absolute http(s) <loc> entries
 * are returned; malformed entries are silently skipped.
 */
export function parseSitemapUrls(xml: string, pathFilter?: string): string[] {
  const urls: string[] = [];
  const locPattern = /<loc>(https?[^<]+)<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = locPattern.exec(xml)) !== null) {
    const url = match[1].trim();
    if (pathFilter) {
      try {
        if (!new URL(url).pathname.startsWith(pathFilter)) continue;
      } catch {
        continue;
      }
    }
    urls.push(url);
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
    // RSS/Atom path: discover article URLs from the feed, then fetch each concurrently.
    // Falls back to the blog index when the feed errors or yields 0 in-window articles.
    let articleUrls: string[] = [];
    let rssFetchFailed = false;

    try {
      const rssXml = await fetch(company.rss_url);
      articleUrls = parseRssArticleUrls(rssXml);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[scraper] error fetching RSS ${company.rss_url}: ${error}`);
      results.push({ url: company.rss_url, action: "error", error });
      rssFetchFailed = true;
      // Record the broken feed in the DB for diagnostic visibility — fire-and-forget.
      try {
        await recordFeedError(sql, company.name, company.rss_url, error);
      } catch {
        // Never block the scrape pipeline on an observability write.
      }
    }

    if (articleUrls.length > 0) {
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
    } else {
      // RSS errored or returned 0 in-window articles — fall back to the blog index
      // so the vendor is never silently absent from raw pages.
      if (!rssFetchFailed) {
        console.info(
          `[scraper] RSS returned 0 in-window articles for ${company.name}, falling back to blog index`
        );
      }
      try {
        const content = await fetch(company.blog_url);
        results.push(await upsertPage(sql, upsert, company.name, company.blog_url, content));
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[scraper] error fetching blog fallback ${company.blog_url}: ${error}`);
        results.push({ url: company.blog_url, action: "error", error });
      }
    }
  } else if (company.sitemap_url) {
    // Sitemap path: discover article URLs from the sitemap, then fetch each concurrently.
    // No pre-fetch date filter — the sitemap has no reliable date metadata, so recency
    // filtering runs downstream in the extractor (isStale()).
    let articleUrls: string[] = [];
    let sitemapFailed = false;

    try {
      const sitemapXml = await fetch(company.sitemap_url);
      articleUrls = parseSitemapUrls(sitemapXml, company.sitemap_path_filter);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[scraper] error fetching sitemap ${company.sitemap_url}: ${error}`);
      results.push({ url: company.sitemap_url, action: "error", error });
      sitemapFailed = true;
    }

    if (articleUrls.length > 0) {
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
    } else {
      if (!sitemapFailed) {
        console.info(
          `[scraper] sitemap returned 0 matching URLs for ${company.name}, falling back to blog index`
        );
      }
      try {
        const content = await fetch(company.blog_url);
        results.push(await upsertPage(sql, upsert, company.name, company.blog_url, content));
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[scraper] error fetching blog fallback ${company.blog_url}: ${error}`);
        results.push({ url: company.blog_url, action: "error", error });
      }
    }
  } else {
    // No RSS or sitemap URL — fetch blog index as a single page.
    try {
      const content = await fetch(company.blog_url);
      results.push(await upsertPage(sql, upsert, company.name, company.blog_url, content));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[scraper] error fetching ${company.blog_url}: ${error}`);
      results.push({ url: company.blog_url, action: "error", error });
    }
  }

  // GitHub releases: always fetch directly (unchanged).
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
