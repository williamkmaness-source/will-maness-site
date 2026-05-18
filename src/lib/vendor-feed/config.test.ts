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
});

describe("companies (built-in config)", () => {
  it("loads all 15 companies without error", () => {
    expect(companies).toHaveLength(15);
  });

  it("every company has a valid blog_url and github_org", () => {
    for (const c of companies) {
      expect(c.blog_url).toMatch(/^https?:\/\//);
      expect(c.github_org.length).toBeGreaterThan(0);
    }
  });
});
