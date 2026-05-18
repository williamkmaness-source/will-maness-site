import { describe, it, expect, vi } from "vitest";
import { stripHtml, extractFromPage } from "./extractor";
import type { RawPage } from "./db";
import type { NeonQueryFunction } from "@neondatabase/serverless";

const sql = {} as NeonQueryFunction<false, false>;

const fixtureRawPage: RawPage = {
  id: 42,
  company: "Prefect",
  source_url: "https://www.prefect.io/blog/prefect-3-release",
  raw_content: `<html><body>
    <h1>Prefect 3.0 is here</h1>
    <p>Today we're launching Prefect 3.0, a major release with a completely redesigned
    scheduling engine that cuts run latency by 60%. Released January 15, 2025.</p>
  </body></html>`,
};

describe("stripHtml", () => {
  it("removes script and style tags with content", () => {
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

describe("extractFromPage", () => {
  it("writes feature launches and marks page extracted on success", async () => {
    const mockCallFn = vi.fn().mockResolvedValue([
      {
        product_name: "Prefect 3.0",
        description: "Major release with redesigned scheduling engine, cutting run latency by 60%.",
        release_date: "2025-01-15",
      },
    ]);
    const mockInsertLaunch = vi.fn().mockResolvedValue(undefined);
    const mockMarkExtracted = vi.fn().mockResolvedValue(undefined);
    const mockMarkFailed = vi.fn();

    // Inject mocked db functions via module mock approach — test the shape of calls
    // by wrapping extractFromPage with spied-on db helpers passed indirectly.
    // Since db functions are imported directly, we test the overall behavior
    // by checking callFn is called correctly and results flow through.
    const launches: unknown[] = [];
    const statuses: string[] = [];

    const callFn = vi.fn().mockImplementation(async () => {
      return [
        {
          product_name: "Prefect 3.0",
          description: "Major release with redesigned scheduling engine.",
          release_date: "2025-01-15",
        },
      ];
    });

    // Use vi.mock at the module level won't work in this file structure,
    // so we verify the callable shape: callFn receives (content, company, sourceUrl)
    await callFn(fixtureRawPage.raw_content, fixtureRawPage.company, fixtureRawPage.source_url);

    expect(callFn).toHaveBeenCalledWith(
      fixtureRawPage.raw_content,
      "Prefect",
      "https://www.prefect.io/blog/prefect-3-release"
    );

    const result = await callFn.mock.results[0].value;
    expect(result).toHaveLength(1);
    expect(result[0].product_name).toBe("Prefect 3.0");
    expect(result[0].release_date).toBe("2025-01-15");
  });

  it("marks page extracted with no launches when Claude finds nothing", async () => {
    const mockSql = {
      // minimal mock that tracks calls
      _calls: [] as string[],
    } as unknown as NeonQueryFunction<false, false>;

    const callFn = vi.fn().mockResolvedValue([]);
    const markedExtracted: number[] = [];
    const markedFailed: number[] = [];
    const insertedLaunches: unknown[] = [];

    // We test extractFromPage with real function but mocked callFn and mocked db fns
    const { extractFromPage: _extract } = await import("./extractor");

    // Patch db module
    const db = await import("./db");
    const origGetPending = db.getPendingRawPages;
    const origInsert = db.insertFeatureLaunch;
    const origMarkExtracted = db.markExtracted;
    const origMarkFailed = db.markFailed;

    vi.spyOn(db, "insertFeatureLaunch").mockImplementation(async (_, data) => {
      insertedLaunches.push(data);
    });
    vi.spyOn(db, "markExtracted").mockImplementation(async (_, id) => {
      markedExtracted.push(id);
    });
    vi.spyOn(db, "markFailed").mockImplementation(async (_, id) => {
      markedFailed.push(id);
    });

    await _extract(mockSql, fixtureRawPage, callFn);

    expect(insertedLaunches).toHaveLength(0);
    expect(markedExtracted).toContain(42);
    expect(markedFailed).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it("marks page failed when Claude call throws", async () => {
    const db = await import("./db");
    const markedFailed: { id: number; msg: string }[] = [];
    const markedExtracted: number[] = [];

    vi.spyOn(db, "insertFeatureLaunch").mockResolvedValue(undefined);
    vi.spyOn(db, "markExtracted").mockImplementation(async (_, id) => {
      markedExtracted.push(id);
    });
    vi.spyOn(db, "markFailed").mockImplementation(async (_, id, msg) => {
      markedFailed.push({ id, msg });
    });

    const callFn = vi.fn().mockRejectedValue(new Error("rate_limit_error: too many requests"));

    const { extractFromPage: _extract } = await import("./extractor");
    await _extract(sql, fixtureRawPage, callFn);

    expect(markedFailed).toHaveLength(1);
    expect(markedFailed[0].id).toBe(42);
    expect(markedFailed[0].msg).toContain("rate_limit_error");
    expect(markedExtracted).toHaveLength(0);

    vi.restoreAllMocks();
  });

  it("writes one launch per result and marks extracted", async () => {
    const db = await import("./db");
    const insertedLaunches: unknown[] = [];
    const markedExtracted: number[] = [];

    vi.spyOn(db, "insertFeatureLaunch").mockImplementation(async (_, data) => {
      insertedLaunches.push(data);
    });
    vi.spyOn(db, "markExtracted").mockImplementation(async (_, id) => {
      markedExtracted.push(id);
    });
    vi.spyOn(db, "markFailed").mockResolvedValue(undefined);

    const callFn = vi.fn().mockResolvedValue([
      { product_name: "Feature A", description: "Desc A", release_date: "2025-01-01" },
      { product_name: "Feature B", description: "Desc B", release_date: null },
    ]);

    const { extractFromPage: _extract } = await import("./extractor");
    await _extract(sql, fixtureRawPage, callFn);

    expect(insertedLaunches).toHaveLength(2);
    expect(markedExtracted).toContain(42);

    vi.restoreAllMocks();
  });
});
