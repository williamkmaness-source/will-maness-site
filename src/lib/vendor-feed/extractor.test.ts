import { describe, it, expect, vi, afterEach } from "vitest";
import { stripHtml, extractFromPage, type ExtractedEntities } from "./extractor";
import type { RawPage } from "./db";
import type { NeonQueryFunction } from "@neondatabase/serverless";

const sql = {} as NeonQueryFunction<false, false>;

const fixtureRawPage: RawPage = {
  id: 42,
  company: "Prefect",
  source_url: "https://www.prefect.io/blog/q1-update",
  raw_content: `<html><body>
    <h1>Q1 2025 Product Update</h1>
    <p>Prefect 3.0 launches today with a redesigned scheduling engine. Pricing moves to usage-based.
    New partnership with Snowflake for native integration. Infrastructure migrated from Celery to Ray.</p>
  </body></html>`,
  scraped_at: new Date("2025-02-01T00:00:00Z"),
};

const emptyEntities: ExtractedEntities = {
  feature_launches: [],
  pricing_changes: [],
  partnerships: [],
  architectural_shifts: [],
};

const allEntities: ExtractedEntities = {
  feature_launches: [
    { product_name: "Prefect 3.0", description: "Redesigned scheduling engine.", release_date: "2025-01-15" },
  ],
  pricing_changes: [
    { description: "Moved to usage-based pricing.", direction: "restructure", effective_date: "2025-02-01" },
  ],
  partnerships: [
    {
      partner_company: "Snowflake",
      integration_type: "native connector",
      description: "Native Snowflake integration.",
      announced_date: "2025-01-20",
    },
  ],
  architectural_shifts: [
    {
      from_technology: "Celery",
      to_technology: "Ray",
      description: "Infrastructure migrated from Celery to Ray.",
      announced_date: "2025-01-15",
    },
  ],
};

// ── stripHtml ─────────────────────────────────────────────────────────────────

describe("stripHtml", () => {
  it("removes script and style tags with their content", () => {
    const html = `<script>alert(1)</script><style>.a{}</style><p>hello</p>`;
    expect(stripHtml(html)).toBe("hello");
  });

  it("collapses whitespace", () => {
    expect(stripHtml("<p>  foo   bar  </p>")).toBe("foo bar");
  });

  it("passes through plain text unchanged", () => {
    expect(stripHtml("plain text")).toBe("plain text");
  });
});

// ── extractFromPage ───────────────────────────────────────────────────────────

describe("extractFromPage", () => {
  async function setup() {
    const db = await import("./db");
    const inserted: Record<string, unknown[]> = {
      launches: [],
      pricing: [],
      partnerships: [],
      arch: [],
    };
    const markedExtracted: number[] = [];
    const markedFailed: { id: number; msg: string }[] = [];

    vi.spyOn(db, "insertFeatureLaunch").mockImplementation(async (_, d) => { inserted.launches.push(d); });
    vi.spyOn(db, "insertPricingChange").mockImplementation(async (_, d) => { inserted.pricing.push(d); });
    vi.spyOn(db, "insertPartnership").mockImplementation(async (_, d) => { inserted.partnerships.push(d); });
    vi.spyOn(db, "insertArchitecturalShift").mockImplementation(async (_, d) => { inserted.arch.push(d); });
    vi.spyOn(db, "markExtracted").mockImplementation(async (_, id) => { markedExtracted.push(id); });
    vi.spyOn(db, "markFailed").mockImplementation(async (_, id, msg) => { markedFailed.push({ id, msg }); });

    return { db, inserted, markedExtracted, markedFailed };
  }

  afterEach(() => vi.restoreAllMocks());

  it("writes all 4 entity types and marks page extracted", async () => {
    const { inserted, markedExtracted } = await setup();
    const callFn = vi.fn().mockResolvedValue(allEntities);

    const { extractFromPage: _extract } = await import("./extractor");
    await _extract(sql, fixtureRawPage, callFn);

    expect(inserted.launches).toHaveLength(1);
    expect(inserted.pricing).toHaveLength(1);
    expect(inserted.partnerships).toHaveLength(1);
    expect(inserted.arch).toHaveLength(1);
    expect(markedExtracted).toContain(42);
  });

  it("marks extracted with no rows written when Claude finds nothing", async () => {
    const { inserted, markedExtracted, markedFailed } = await setup();
    const callFn = vi.fn().mockResolvedValue(emptyEntities);

    const { extractFromPage: _extract } = await import("./extractor");
    await _extract(sql, fixtureRawPage, callFn);

    expect(inserted.launches).toHaveLength(0);
    expect(inserted.pricing).toHaveLength(0);
    expect(inserted.partnerships).toHaveLength(0);
    expect(inserted.arch).toHaveLength(0);
    expect(markedExtracted).toContain(42);
    expect(markedFailed).toHaveLength(0);
  });

  it("marks page failed when Claude call throws", async () => {
    const { markedFailed, markedExtracted } = await setup();
    const callFn = vi.fn().mockRejectedValue(new Error("rate_limit_error: too many requests"));

    const { extractFromPage: _extract } = await import("./extractor");
    await _extract(sql, fixtureRawPage, callFn);

    expect(markedFailed).toHaveLength(1);
    expect(markedFailed[0].id).toBe(42);
    expect(markedFailed[0].msg).toContain("rate_limit_error");
    expect(markedExtracted).toHaveLength(0);
  });

  it("correctly maps pricing change fields", async () => {
    const { inserted } = await setup();
    const callFn = vi.fn().mockResolvedValue({
      ...emptyEntities,
      pricing_changes: [
        { description: "Price increase across all tiers", direction: "increase", effective_date: "2025-03-01" },
      ],
    });

    const { extractFromPage: _extract } = await import("./extractor");
    await _extract(sql, fixtureRawPage, callFn);

    const p = inserted.pricing[0] as { direction: string; effectiveDate: string };
    expect(p.direction).toBe("increase");
    expect(p.effectiveDate).toBe("2025-03-01");
  });

  it("correctly maps partnership fields", async () => {
    const { inserted } = await setup();
    const callFn = vi.fn().mockResolvedValue({
      ...emptyEntities,
      partnerships: [
        { partner_company: "Databricks", integration_type: "OEM", description: "OEM deal with Databricks.", announced_date: "2025-02-10" },
      ],
    });

    const { extractFromPage: _extract } = await import("./extractor");
    await _extract(sql, fixtureRawPage, callFn);

    const p = inserted.partnerships[0] as { partnerCompany: string; integrationType: string };
    expect(p.partnerCompany).toBe("Databricks");
    expect(p.integrationType).toBe("OEM");
  });

  it("correctly maps architectural shift fields", async () => {
    const { inserted } = await setup();
    const callFn = vi.fn().mockResolvedValue({
      ...emptyEntities,
      architectural_shifts: [
        { from_technology: "Celery", to_technology: "Ray", description: "Migrated to Ray.", announced_date: null },
      ],
    });

    const { extractFromPage: _extract } = await import("./extractor");
    await _extract(sql, fixtureRawPage, callFn);

    const a = inserted.arch[0] as { fromTechnology: string; toTechnology: string; announcedDate: null };
    expect(a.fromTechnology).toBe("Celery");
    expect(a.toTechnology).toBe("Ray");
    expect(a.announcedDate).toBeNull();
  });

  it("skips entities older than 90 days from scraped_at", async () => {
    const { inserted, markedExtracted } = await setup();
    const callFn = vi.fn().mockResolvedValue({
      feature_launches: [
        { product_name: "Old Product", description: "Old launch", release_date: "2024-01-01" }, // Stale
        { product_name: "New Product", description: "New launch", release_date: "2025-01-20" }, // Not stale
      ],
      pricing_changes: [],
      partnerships: [],
      architectural_shifts: [],
    });

    const { extractFromPage: _extract } = await import("./extractor");
    await _extract(sql, fixtureRawPage, callFn);

    expect(inserted.launches).toHaveLength(1);
    const l = inserted.launches[0] as { productName: string };
    expect(l.productName).toBe("New Product");
    expect(markedExtracted).toContain(42);
  });

  it("regression #101: correctly overrides LLM inference with canonical date and drops 2025 MetricFlow article scraped in 2026", async () => {
    const { inserted, markedExtracted } = await setup();
    
    // Simulate issue #101: The scrape happens in 2026, and the LLM infers the scrape date (2026) 
    // because it doesn't see the HTML metadata, but the article is actually from 2025.
    const metricFlowPage = {
      ...fixtureRawPage,
      company: "dbt Labs",
      scraped_at: new Date("2026-05-20T00:00:00Z"),
      raw_content: `<html><head><meta property="article:published_time" content="2025-10-15T12:00:00Z"></head><body>MetricFlow open sourced.</body></html>`
    };

    const callFn = vi.fn().mockResolvedValue({
      feature_launches: [
        { 
          product_name: "MetricFlow (Open Source)", 
          description: "dbt Labs open-sourced MetricFlow.", 
          release_date: "2026-05-20" // LLM hallucinates the 2026 scrape date or wrapper date
        }, 
      ],
      pricing_changes: [],
      partnerships: [],
      architectural_shifts: [],
    });

    const { extractFromPage: _extract } = await import("./extractor");
    await _extract(sql, metricFlowPage, callFn);

    // The canonical date (2025-10-15) overrides the LLM date (2026-05-20).
    // Because 2025-10-15 is > 90 days older than the scrape date (2026-05-20), it gets skipped.
    expect(inserted.launches).toHaveLength(0);
    expect(markedExtracted).toContain(42);
  });
});
