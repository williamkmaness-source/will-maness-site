// Tests for the music-ingest cron handler (issue #215).
// Mocks the Neon driver, the pipeline steps, and the Spotify client — no network, no DB.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, isChartRefreshDay, runMusicIngest } from "./route";

const mockRunScrape = vi.fn();
const mockRunExtract = vi.fn();
const mockRunScore = vi.fn();
const mockRecordPipelineRun = vi.fn();

vi.mock("@/lib/music-analyzer/music-pipeline", () => ({
  runScrape: (...args: unknown[]) => mockRunScrape(...args),
  runExtract: (...args: unknown[]) => mockRunExtract(...args),
  runScore: (...args: unknown[]) => mockRunScore(...args),
  recordPipelineRun: (...args: unknown[]) => mockRecordPipelineRun(...args),
}));

vi.mock("@/lib/music-analyzer/spotify-client", () => ({
  SpotifyClient: vi.fn(),
}));

const mockSql = vi.fn();

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

function makeRequest(authHeader?: string) {
  return {
    headers: {
      get: (key: string) => (key === "authorization" ? (authHeader ?? null) : null),
    },
  } as unknown as import("next/server").NextRequest;
}

// 2026-07-27 is a Monday; 2026-07-28 is a Tuesday.
const MONDAY = new Date("2026-07-27T10:00:00Z");
const TUESDAY = new Date("2026-07-28T10:00:00Z");

describe("isChartRefreshDay", () => {
  it("is true only on Monday (UTC)", () => {
    const week = [
      ["2026-07-27", true], // Mon
      ["2026-07-28", false], // Tue
      ["2026-07-29", false], // Wed
      ["2026-07-30", false], // Thu
      ["2026-07-31", false], // Fri
      ["2026-08-01", false], // Sat
      ["2026-08-02", false], // Sun
    ] as const;

    for (const [day, expected] of week) {
      expect(isChartRefreshDay(new Date(`${day}T12:00:00Z`))).toBe(expected);
    }
  });
});

describe("runMusicIngest", () => {
  beforeEach(() => {
    mockRunScrape.mockReset().mockResolvedValue({ snapshotWeek: "2026-07-27", scraped: 100 });
    mockRunExtract
      .mockReset()
      .mockResolvedValue({ snapshotWeek: "2026-07-27", extracted: 97, unresolved: 2, failed: 1 });
    mockRunScore
      .mockReset()
      .mockResolvedValue({ snapshotWeek: "2026-07-27", tracksScored: 97, scoreCount: 34 });
  });

  it("runs scrape, then extract, then score, and aggregates the counts", async () => {
    const { neon } = await import("@neondatabase/serverless");
    const { SpotifyClient } = await import("@/lib/music-analyzer/spotify-client");

    const result = await runMusicIngest(
      neon("dummy"),
      new SpotifyClient("id", "secret"),
      MONDAY
    );

    expect(result).toEqual({
      snapshotWeek: "2026-07-27",
      scraped: 100,
      extracted: 97,
      unresolved: 2,
      failed: 1,
      tracksScored: 97,
      scoreCount: 34,
    });
    expect(mockRunScrape).toHaveBeenCalledBefore(mockRunExtract);
    expect(mockRunExtract).toHaveBeenCalledBefore(mockRunScore);
  });
});

describe("GET", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    mockRunScrape.mockReset().mockResolvedValue({ snapshotWeek: "2026-07-27", scraped: 100 });
    mockRunExtract
      .mockReset()
      .mockResolvedValue({ snapshotWeek: "2026-07-27", extracted: 100, unresolved: 0, failed: 0 });
    mockRunScore
      .mockReset()
      .mockResolvedValue({ snapshotWeek: "2026-07-27", tracksScored: 100, scoreCount: 30 });
    mockRecordPipelineRun.mockReset().mockResolvedValue(undefined);
    process.env = {
      ...originalEnv,
      POSTGRES_URL: "postgres://dummy",
      SPOTIFY_CLIENT_ID: "id",
      SPOTIFY_CLIENT_SECRET: "secret",
    };
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
  });

  it("returns a skipped no-op 200 on a non-Monday run", async () => {
    vi.setSystemTime(TUESDAY);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "skipped", reason: "not Monday" });
    expect(mockRunScrape).not.toHaveBeenCalled();
    expect(mockRecordPipelineRun).not.toHaveBeenCalled();
  });

  it("runs the pipeline on Monday and records a successful run", async () => {
    vi.setSystemTime(MONDAY);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      status: "ran",
      snapshotWeek: "2026-07-27",
      scraped: 100,
    });
    expect(mockRecordPipelineRun).toHaveBeenCalledWith(mockSql, "success", 100, null);
  });

  it("records a failed run and still returns 200 so Cron does not retry-storm", async () => {
    vi.setSystemTime(MONDAY);
    mockRunScrape.mockRejectedValue(new Error("HTTP 503 from billboard.com"));

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "Music ingest failed" });
    expect(mockRecordPipelineRun).toHaveBeenCalledWith(
      mockSql,
      "failed",
      null,
      "HTTP 503 from billboard.com"
    );
  });

  it("rejects an unauthorized request when CRON_SECRET is set", async () => {
    vi.setSystemTime(MONDAY);
    process.env.CRON_SECRET = "shhh";

    const res = await GET(makeRequest("Bearer wrong"));

    expect(res.status).toBe(401);
    expect(mockRunScrape).not.toHaveBeenCalled();
  });

  it("accepts a correctly authorized request when CRON_SECRET is set", async () => {
    vi.setSystemTime(MONDAY);
    process.env.CRON_SECRET = "shhh";

    const res = await GET(makeRequest("Bearer shhh"));

    expect(res.status).toBe(200);
    expect(mockRunScrape).toHaveBeenCalled();
  });

  it("fails fast with 500 when Spotify credentials are missing", async () => {
    vi.setSystemTime(MONDAY);
    delete process.env.SPOTIFY_CLIENT_ID;

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(mockRunScrape).not.toHaveBeenCalled();
  });

  it("fails fast with 500 when no Postgres connection string is configured", async () => {
    vi.setSystemTime(MONDAY);
    delete process.env.POSTGRES_URL;
    delete process.env.POSTGRES_URL_NON_POOLING;

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(mockRunScrape).not.toHaveBeenCalled();
  });
});
