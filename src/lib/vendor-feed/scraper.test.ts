import { describe, it, expect, vi } from "vitest";
import { hashContent, getSourceUrls, parseRssArticleUrls, scrapeCompany } from "./scraper";
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

// Minimal sql mock — passed through to upsert which we also mock
const sql = {} as NeonQueryFunction<false, false>;

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

  it("RSS path: returns error when RSS fetch fails, still attempts github releases", async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error("RSS fetch failed"))
      .mockResolvedValueOnce("releases content");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const results = await scrapeCompany(companyWithAll, mockUpsert, sql, mockFetch);

    expect(results[0].action).toBe("error");
    expect(results[0].url).toBe("https://acme.com/feed.xml");
    // github releases still runs
    expect(results[1].action).toBe("inserted");
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
});
