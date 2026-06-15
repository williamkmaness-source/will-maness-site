import { describe, it, expect, vi } from "vitest";
import { hashContent, getSourceUrls, parseRssArticleUrls, parseSitemapUrls, scrapeCompany } from "./scraper";
import type { Company } from "./config";
import type { NeonQueryFunction } from "@neondatabase/serverless";

const baseCompany: Company = {
  name: "Acme",
  blog_url: "https://acme.com/blog",
  github_org: "acme-inc",
};

const companyWithAll: Company = {
  ...baseCompany,
  rss_url: "https://acme.com/feed.xml",
  github_releases_url: "https://github.com/acme-inc/acme/releases",
};

const companyWithReleasesOnly: Company = {
  ...baseCompany,
  github_releases_url: "https://github.com/acme-inc/acme/releases",
};

// sql mock supports tagged template literals; recordFeedError calls it directly on RSS errors.
const sql = vi.fn().mockResolvedValue([]) as unknown as NeonQueryFunction<false, false>;

// ── hashContent ─────────────────────────────────────────────────────────────

describe("hashContent", () => {
  it("same content produces same hash", () => {
    expect(hashContent("hello")).toBe(hashContent("hello"));
  });

  it("different content produces different hash", () => {
    expect(hashContent("hello")).not.toBe(hashContent("world"));
  });

  it("returns a 64-char hex string", () => {
    expect(hashContent("x")).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ── getSourceUrls ───────────────────────────────────────────────────────────

describe("getSourceUrls", () => {
  it("returns blog_url when no github_releases_url", () => {
    expect(getSourceUrls(baseCompany)).toEqual(["https://acme.com/blog"]);
  });

  it("returns blog_url even when rss_url is present (RSS is handled separately)", () => {
    const urls = getSourceUrls(companyWithAll);
    expect(urls[0]).toBe("https://acme.com/blog");
  });

  it("includes github_releases_url when present", () => {
    const urls = getSourceUrls(companyWithAll);
    expect(urls).toContain("https://github.com/acme-inc/acme/releases");
  });

  it("returns two urls when both rss_url and github_releases_url set", () => {
    expect(getSourceUrls(companyWithAll)).toHaveLength(2);
  });
});

// ── parseRssArticleUrls ─────────────────────────────────────────────────────

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Acme Blog</title>
    <item>
      <title>Fresh Article</title>
      <link>https://acme.com/blog/fresh</link>
      <pubDate>Mon, 09 Jun 2026 10:00:00 +0000</pubDate>
    </item>
    <item>
      <title>Old Article</title>
      <link>https://acme.com/blog/old</link>
      <pubDate>Fri, 01 Jan 2021 10:00:00 +0000</pubDate>
    </item>
    <item>
      <title>No Date Article</title>
      <link>https://acme.com/blog/no-date</link>
    </item>
    <item>
      <title>Atom Link Article</title>
      <link href="https://acme.com/blog/atom" rel="alternate"/>
      <pubDate>Sun, 08 Jun 2026 12:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

describe("parseRssArticleUrls", () => {
  const referenceDate = new Date("2026-06-10T00:00:00Z");

  it("extracts article URLs from valid RSS", () => {
    const urls = parseRssArticleUrls(RSS_FIXTURE, 90, referenceDate);
    expect(urls).toContain("https://acme.com/blog/fresh");
  });

  it("applies 90-day filter — excludes articles older than cutoff", () => {
    const urls = parseRssArticleUrls(RSS_FIXTURE, 90, referenceDate);
    expect(urls).not.toContain("https://acme.com/blog/old");
  });

  it("includes items with no pubDate (can't filter what we can't read)", () => {
    const urls = parseRssArticleUrls(RSS_FIXTURE, 90, referenceDate);
    expect(urls).toContain("https://acme.com/blog/no-date");
  });

  it("extracts Atom-style href links", () => {
    const urls = parseRssArticleUrls(RSS_FIXTURE, 90, referenceDate);
    expect(urls).toContain("https://acme.com/blog/atom");
  });

  it("returns empty array for empty RSS", () => {
    expect(parseRssArticleUrls("<rss><channel></channel></rss>", 90, referenceDate)).toHaveLength(0);
  });

  it("respects custom cutoffDays", () => {
    // With 1-day cutoff from 2026-06-10, only articles from 2026-06-09+ pass
    const urls = parseRssArticleUrls(RSS_FIXTURE, 1, referenceDate);
    expect(urls).toContain("https://acme.com/blog/fresh");
    expect(urls).not.toContain("https://acme.com/blog/atom"); // 2026-06-08, 2 days old
  });
});

// ── parseRssArticleUrls — Atom feeds ────────────────────────────────────────

const ATOM_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>dltHub Blog</title>
  <updated>2026-06-11T00:00:00Z</updated>
  <entry>
    <title>Recent Atom Article</title>
    <link href="https://dlthub.com/blog/recent" rel="alternate"/>
    <published>2026-05-15T10:00:00Z</published>
    <updated>2026-05-16T10:00:00Z</updated>
  </entry>
  <entry>
    <title>Old Atom Article</title>
    <link href="https://dlthub.com/blog/old" rel="alternate"/>
    <published>2025-01-01T10:00:00Z</published>
    <updated>2025-01-02T10:00:00Z</updated>
  </entry>
  <entry>
    <title>No Date Atom Article</title>
    <link href="https://dlthub.com/blog/no-date" rel="alternate"/>
  </entry>
  <entry>
    <title>Updated-only Article</title>
    <link href="https://dlthub.com/blog/updated-only" rel="alternate"/>
    <updated>2026-06-01T10:00:00Z</updated>
  </entry>
</feed>`;

describe("parseRssArticleUrls — Atom feeds", () => {
  const referenceDate = new Date("2026-06-10T00:00:00Z");

  it("extracts URLs from Atom <entry> blocks", () => {
    const urls = parseRssArticleUrls(ATOM_FIXTURE, 90, referenceDate);
    expect(urls).toContain("https://dlthub.com/blog/recent");
  });

  it("applies 90-day filter to Atom entries using <published>", () => {
    const urls = parseRssArticleUrls(ATOM_FIXTURE, 90, referenceDate);
    expect(urls).not.toContain("https://dlthub.com/blog/old");
  });

  it("includes Atom entries with no date", () => {
    const urls = parseRssArticleUrls(ATOM_FIXTURE, 90, referenceDate);
    expect(urls).toContain("https://dlthub.com/blog/no-date");
  });

  it("falls back to <updated> when <published> is absent in an entry", () => {
    const urls = parseRssArticleUrls(ATOM_FIXTURE, 90, referenceDate);
    expect(urls).toContain("https://dlthub.com/blog/updated-only");
  });

  it("does not use the feed-level <updated> as an entry date", () => {
    // Feed has <updated>2026-06-11</updated> at top level; old entry has published=2025-01-01.
    // If the feed-level tag leaked into entry parsing the old article would wrongly pass.
    const urls = parseRssArticleUrls(ATOM_FIXTURE, 90, referenceDate);
    expect(urls).not.toContain("https://dlthub.com/blog/old");
  });

  it("returns empty array for an Atom feed with no entries in window", () => {
    const allOld = `<feed xmlns="http://www.w3.org/2005/Atom">
      <entry><link href="https://x.com/1"/><published>2020-01-01T00:00:00Z</published></entry>
    </feed>`;
    expect(parseRssArticleUrls(allOld, 90, referenceDate)).toHaveLength(0);
  });
});

// ── parseSitemapUrls ─────────────────────────────────────────────────────────

const SITEMAP_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.llamaindex.ai/blog/intro</loc><lastmod>2026-01-01</lastmod></url>
  <url><loc>https://www.llamaindex.ai/blog/deep-dive</loc></url>
  <url><loc>https://www.llamaindex.ai/about</loc></url>
  <url><loc>https://www.llamaindex.ai/pricing</loc></url>
</urlset>`;

describe("parseSitemapUrls", () => {
  it("extracts all <loc> URLs when no path filter is given", () => {
    const urls = parseSitemapUrls(SITEMAP_FIXTURE);
    expect(urls).toHaveLength(4);
    expect(urls).toContain("https://www.llamaindex.ai/blog/intro");
    expect(urls).toContain("https://www.llamaindex.ai/pricing");
  });

  it("applies path filter — includes only matching paths", () => {
    const urls = parseSitemapUrls(SITEMAP_FIXTURE, "/blog/");
    expect(urls).toHaveLength(2);
    expect(urls).toContain("https://www.llamaindex.ai/blog/intro");
    expect(urls).toContain("https://www.llamaindex.ai/blog/deep-dive");
    expect(urls).not.toContain("https://www.llamaindex.ai/about");
    expect(urls).not.toContain("https://www.llamaindex.ai/pricing");
  });

  it("returns empty array for empty sitemap", () => {
    expect(parseSitemapUrls("<urlset></urlset>")).toHaveLength(0);
  });

  it("ignores non-http <loc> entries", () => {
    const xml = "<urlset><url><loc>ftp://bad.url/path</loc></url></urlset>";
    expect(parseSitemapUrls(xml)).toHaveLength(0);
  });
});

// ── scrapeCompany ───────────────────────────────────────────────────────────

describe("scrapeCompany", () => {
  it("fallback path: fetches blog_url and upserts the result when no rss_url", async () => {
    const mockFetch = vi.fn().mockResolvedValue("<html>content</html>");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const results = await scrapeCompany(baseCompany, mockUpsert, sql, mockFetch);

    expect(mockFetch).toHaveBeenCalledWith("https://acme.com/blog");
    expect(mockUpsert).toHaveBeenCalledWith(sql, {
      company: "Acme",
      sourceUrl: "https://acme.com/blog",
      contentHash: hashContent("<html>content</html>"),
      rawContent: "<html>content</html>",
    });
    expect(results).toHaveLength(1);
    expect(results[0].action).toBe("inserted");
  });

  it("fallback path: returns skipped when upsert returns skipped (same hash)", async () => {
    const mockFetch = vi.fn().mockResolvedValue("unchanged content");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "skipped" });

    const results = await scrapeCompany(baseCompany, mockUpsert, sql, mockFetch);

    expect(results[0].action).toBe("skipped");
    expect(mockUpsert).toHaveBeenCalledOnce();
  });

  it("fallback path: returns error result when fetch fails, without throwing", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("HTTP 503 from https://acme.com/blog"));
    const mockUpsert = vi.fn();

    const results = await scrapeCompany(baseCompany, mockUpsert, sql, mockFetch);

    expect(results[0].action).toBe("error");
    expect(results[0].error).toContain("503");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("fallback path with github releases: fetches blog_url and releases", async () => {
    const mockFetch = vi.fn().mockResolvedValue("content");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const results = await scrapeCompany(companyWithReleasesOnly, mockUpsert, sql, mockFetch);

    expect(mockFetch).toHaveBeenCalledWith("https://acme.com/blog");
    expect(mockFetch).toHaveBeenCalledWith("https://github.com/acme-inc/acme/releases");
    expect(results).toHaveLength(2);
  });

  it("fallback path: continues scraping github releases after blog fetch fails", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce("github content");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 2 });

    const results = await scrapeCompany(companyWithReleasesOnly, mockUpsert, sql, mockFetch);

    expect(results).toHaveLength(2);
    expect(results[0].action).toBe("error");
    expect(results[1].action).toBe("inserted");
  });

  it("RSS path: fetches RSS, parses articles, upserts each article (not the RSS URL)", async () => {
    const rssXml = `<rss><channel>
      <item><link>https://acme.com/article-1</link></item>
      <item><link>https://acme.com/article-2</link></item>
    </channel></rss>`;
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(rssXml)           // RSS fetch
      .mockResolvedValue("<html>article</html>"); // article fetches
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const company: Company = { ...baseCompany, rss_url: "https://acme.com/feed.xml" };
    const results = await scrapeCompany(company, mockUpsert, sql, mockFetch);

    // RSS URL is fetched for discovery but NOT upserted
    expect(mockUpsert).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sourceUrl: "https://acme.com/feed.xml" })
    );
    // Article URLs are upserted
    expect(mockUpsert).toHaveBeenCalledWith(
      sql,
      expect.objectContaining({ sourceUrl: "https://acme.com/article-1" })
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      sql,
      expect.objectContaining({ sourceUrl: "https://acme.com/article-2" })
    );
    expect(results).toHaveLength(2);
  });

  it("RSS path: also fetches github releases when present", async () => {
    const rssXml = `<rss><channel>
      <item><link>https://acme.com/article-1</link></item>
    </channel></rss>`;
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(rssXml)
      .mockResolvedValue("content");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const results = await scrapeCompany(companyWithAll, mockUpsert, sql, mockFetch);

    // 1 article + 1 github releases = 2 upserts
    expect(results).toHaveLength(2);
    expect(mockUpsert).toHaveBeenCalledWith(
      sql,
      expect.objectContaining({ sourceUrl: "https://github.com/acme-inc/acme/releases" })
    );
  });

  it("RSS path: falls back to blog index and fetches github releases after RSS fetch fails", async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error("RSS fetch failed"))   // RSS
      .mockResolvedValueOnce("<html>blog index</html>")        // blog fallback
      .mockResolvedValueOnce("releases content");              // github releases
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const results = await scrapeCompany(companyWithAll, mockUpsert, sql, mockFetch);

    // RSS error is surfaced
    expect(results[0].action).toBe("error");
    expect(results[0].url).toBe("https://acme.com/feed.xml");
    // Blog fallback succeeds
    expect(results[1].action).toBe("inserted");
    expect(results[1].url).toBe("https://acme.com/blog");
    // GitHub releases still runs
    expect(results[2].action).toBe("inserted");
    expect(results[2].url).toBe("https://github.com/acme-inc/acme/releases");
  });

  it("RSS path: article fetch errors are isolated — other articles still upsert", async () => {
    const rssXml = `<rss><channel>
      <item><link>https://acme.com/article-1</link></item>
      <item><link>https://acme.com/article-2</link></item>
    </channel></rss>`;
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(rssXml)
      .mockRejectedValueOnce(new Error("403 Forbidden"))
      .mockResolvedValueOnce("article 2 content");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const company: Company = { ...baseCompany, rss_url: "https://acme.com/feed.xml" };
    const results = await scrapeCompany(company, mockUpsert, sql, mockFetch);

    expect(results).toHaveLength(2);
    const actions = results.map((r) => r.action);
    expect(actions).toContain("error");
    expect(actions).toContain("inserted");
  });

  it("RSS path: falls back to blog index when RSS yields 0 in-window articles", async () => {
    const emptyRss = `<rss><channel></channel></rss>`;
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(emptyRss)             // RSS — no articles
      .mockResolvedValueOnce("<html>blog</html>"); // blog fallback
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const company: Company = { ...baseCompany, rss_url: "https://acme.com/feed.xml" };
    const results = await scrapeCompany(company, mockUpsert, sql, mockFetch);

    expect(mockFetch).toHaveBeenCalledWith("https://acme.com/feed.xml");
    expect(mockFetch).toHaveBeenCalledWith("https://acme.com/blog");
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://acme.com/blog");
    expect(results[0].action).toBe("inserted");
  });

  it("RSS path: records dead feed in DB and falls back to blog index when RSS fetch fails", async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error("HTTP 404 from https://acme.com/feed.xml"))
      .mockResolvedValueOnce("<html>blog index</html>");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const company: Company = { ...baseCompany, rss_url: "https://acme.com/feed.xml" };
    const results = await scrapeCompany(company, mockUpsert, sql, mockFetch);

    // RSS error is surfaced as the first result
    expect(results[0].action).toBe("error");
    expect(results[0].url).toBe("https://acme.com/feed.xml");
    // Blog fallback succeeds
    expect(results[1].action).toBe("inserted");
    expect(results[1].url).toBe("https://acme.com/blog");
    // sql was called to record the dead feed error
    expect(sql).toHaveBeenCalled();
  });

  it("RSS path: concurrency is bounded — fetch calls do not exceed limit", async () => {
    // Build an RSS feed with 8 articles to exceed the concurrency cap
    const items = Array.from({ length: 8 }, (_, i) =>
      `<item><link>https://acme.com/article-${i}</link></item>`
    ).join("\n");
    const rssXml = `<rss><channel>${items}</channel></rss>`;

    let activeConcurrent = 0;
    let maxConcurrent = 0;

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("feed.xml")) return rssXml;
      activeConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, activeConcurrent);
      await new Promise((r) => setTimeout(r, 10)); // simulate async work
      activeConcurrent--;
      return "<html>article</html>";
    });

    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const company: Company = { ...baseCompany, rss_url: "https://acme.com/feed.xml" };
    await scrapeCompany(company, mockUpsert, sql, mockFetch);

    expect(maxConcurrent).toBeLessThanOrEqual(5);
  });

  it("sitemap path: fetches sitemap, parses URLs with path filter, upserts each article", async () => {
    const sitemapXml = `<urlset>
      <url><loc>https://llama.ai/blog/post-1</loc></url>
      <url><loc>https://llama.ai/blog/post-2</loc></url>
      <url><loc>https://llama.ai/about</loc></url>
    </urlset>`;
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(sitemapXml)
      .mockResolvedValue("<html>article</html>");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const company: Company = { ...baseCompany, sitemap_url: "https://llama.ai/sitemap-0.xml", sitemap_path_filter: "/blog/" };
    const results = await scrapeCompany(company, mockUpsert, sql, mockFetch);

    expect(mockFetch).toHaveBeenCalledWith("https://llama.ai/sitemap-0.xml");
    expect(mockUpsert).toHaveBeenCalledWith(sql, expect.objectContaining({ sourceUrl: "https://llama.ai/blog/post-1" }));
    expect(mockUpsert).toHaveBeenCalledWith(sql, expect.objectContaining({ sourceUrl: "https://llama.ai/blog/post-2" }));
    // /about is excluded by path filter
    expect(mockUpsert).not.toHaveBeenCalledWith(sql, expect.objectContaining({ sourceUrl: "https://llama.ai/about" }));
    expect(results).toHaveLength(2);
  });

  it("sitemap path: falls back to blog index when sitemap fetch fails", async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error("HTTP 404"))
      .mockResolvedValueOnce("<html>blog index</html>");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const company: Company = { ...baseCompany, sitemap_url: "https://llama.ai/sitemap-0.xml" };
    const results = await scrapeCompany(company, mockUpsert, sql, mockFetch);

    expect(results[0].action).toBe("error");
    expect(results[0].url).toBe("https://llama.ai/sitemap-0.xml");
    expect(results[1].action).toBe("inserted");
    expect(results[1].url).toBe("https://acme.com/blog");
  });

  it("sitemap path: falls back to blog index when sitemap yields 0 matching URLs", async () => {
    const sitemapXml = `<urlset><url><loc>https://llama.ai/about</loc></url></urlset>`;
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(sitemapXml)
      .mockResolvedValueOnce("<html>blog</html>");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const company: Company = { ...baseCompany, sitemap_url: "https://llama.ai/sitemap-0.xml", sitemap_path_filter: "/blog/" };
    const results = await scrapeCompany(company, mockUpsert, sql, mockFetch);

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://acme.com/blog");
    expect(results[0].action).toBe("inserted");
  });

  it("sitemap path: respects the global concurrency cap", async () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      `<url><loc>https://llama.ai/blog/post-${i}</loc></url>`
    ).join("\n");
    const sitemapXml = `<urlset>${items}</urlset>`;

    let activeConcurrent = 0;
    let maxConcurrent = 0;

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("sitemap-0.xml")) return sitemapXml;
      activeConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, activeConcurrent);
      await new Promise((r) => setTimeout(r, 10));
      activeConcurrent--;
      return "<html>article</html>";
    });

    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const company: Company = { ...baseCompany, sitemap_url: "https://llama.ai/sitemap-0.xml" };
    await scrapeCompany(company, mockUpsert, sql, mockFetch);

    expect(maxConcurrent).toBeLessThanOrEqual(5);
  });
});
