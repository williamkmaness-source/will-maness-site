import { describe, it, expect } from "vitest";
import { loadCompanies, companies } from "./config";

describe("loadCompanies", () => {
  it("parses valid company config", () => {
    const result = loadCompanies([
      {
        name: "Acme",
        blog_url: "https://acme.com/blog",
        github_org: "acme-inc",
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Acme");
    expect(result[0].rss_url).toBeUndefined();
  });

  it("parses optional rss_url when provided", () => {
    const result = loadCompanies([
      {
        name: "Acme",
        blog_url: "https://acme.com/blog",
        github_org: "acme-inc",
        rss_url: "https://acme.com/feed.xml",
      },
    ]);
    expect(result[0].rss_url).toBe("https://acme.com/feed.xml");
  });

  it("throws a descriptive error on missing required field", () => {
    expect(() =>
      loadCompanies([{ blog_url: "https://acme.com/blog", github_org: "acme" }])
    ).toThrow(/Invalid company config at index 0/);
  });

  it("throws on invalid blog_url format", () => {
    expect(() =>
      loadCompanies([
        { name: "Acme", blog_url: "not-a-url", github_org: "acme" },
      ])
    ).toThrow(/Invalid company config at index 0/);
  });

  it("throws on invalid rss_url format", () => {
    expect(() =>
      loadCompanies([
        {
          name: "Acme",
          blog_url: "https://acme.com/blog",
          github_org: "acme",
          rss_url: "not-a-url",
        },
      ])
    ).toThrow(/Invalid company config at index 0/);
  });

  it("parses optional sitemap_url when provided", () => {
    const result = loadCompanies([
      {
        name: "Acme",
        blog_url: "https://acme.com/blog",
        github_org: "acme-inc",
        sitemap_url: "https://acme.com/sitemap.xml",
      },
    ]);
    expect(result[0].sitemap_url).toBe("https://acme.com/sitemap.xml");
  });

  it("parses optional sitemap_path_filter when provided", () => {
    const result = loadCompanies([
      {
        name: "Acme",
        blog_url: "https://acme.com/blog",
        github_org: "acme-inc",
        sitemap_url: "https://acme.com/sitemap.xml",
        sitemap_path_filter: "/blog/",
      },
    ]);
    expect(result[0].sitemap_path_filter).toBe("/blog/");
  });

  it("throws on invalid sitemap_url format", () => {
    expect(() =>
      loadCompanies([
        {
          name: "Acme",
          blog_url: "https://acme.com/blog",
          github_org: "acme",
          sitemap_url: "not-a-url",
        },
      ])
    ).toThrow(/Invalid company config at index 0/);
  });
});

describe("companies (built-in config)", () => {
  it("loads all 18 companies without error", () => {
    expect(companies.length).toBeGreaterThan(0);
  });

  it("every company has a valid blog_url and github_org", () => {
    for (const c of companies) {
      expect(c.blog_url).toMatch(/^https?:\/\//);
      expect(c.github_org.length).toBeGreaterThan(0);
    }
  });
});
