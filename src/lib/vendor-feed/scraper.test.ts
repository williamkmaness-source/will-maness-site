import { describe, it, expect, vi } from "vitest";
import { hashContent, getSourceUrls, scrapeCompany } from "./scraper";
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

// Minimal sql mock — scrapeCompany passes it through to upsert, which we also mock
const sql = {} as NeonQueryFunction<false, false>;

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

describe("getSourceUrls", () => {
  it("returns blog_url when no rss_url or github_releases_url", () => {
    expect(getSourceUrls(baseCompany)).toEqual(["https://acme.com/blog"]);
  });

  it("prefers rss_url over blog_url", () => {
    const urls = getSourceUrls(companyWithAll);
    expect(urls[0]).toBe("https://acme.com/feed.xml");
  });

  it("includes github_releases_url when present", () => {
    const urls = getSourceUrls(companyWithAll);
    expect(urls).toContain("https://github.com/acme-inc/acme/releases");
  });

  it("returns two urls when both rss_url and github_releases_url set", () => {
    expect(getSourceUrls(companyWithAll)).toHaveLength(2);
  });
});

describe("scrapeCompany", () => {
  it("calls fetch with the correct URL and upserts the result", async () => {
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

  it("skips when upsert returns skipped (same hash in DB)", async () => {
    const mockFetch = vi.fn().mockResolvedValue("unchanged content");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "skipped" });

    const results = await scrapeCompany(baseCompany, mockUpsert, sql, mockFetch);

    expect(results[0].action).toBe("skipped");
    expect(mockUpsert).toHaveBeenCalledOnce();
  });

  it("returns error result when fetch fails, without throwing", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("HTTP 503 from https://acme.com/blog"));
    const mockUpsert = vi.fn();

    const results = await scrapeCompany(baseCompany, mockUpsert, sql, mockFetch);

    expect(results[0].action).toBe("error");
    expect(results[0].error).toContain("503");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("scrapes all urls for a company with rss and github releases", async () => {
    const mockFetch = vi.fn().mockResolvedValue("content");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 1 });

    const results = await scrapeCompany(companyWithAll, mockUpsert, sql, mockFetch);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
  });

  it("continues scraping remaining urls after one fetch fails", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce("github content");
    const mockUpsert = vi.fn().mockResolvedValue({ action: "inserted", id: 2 });

    const results = await scrapeCompany(companyWithAll, mockUpsert, sql, mockFetch);

    expect(results).toHaveLength(2);
    expect(results[0].action).toBe("error");
    expect(results[1].action).toBe("inserted");
  });
});
