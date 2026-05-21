// Tests for the chess health cron handler (issue #46).
// Exercises upsertPipelineRun and the GET handler's branching logic
// without hitting Lichess or Neon. Follows the BroadcastService.test.ts pattern
// (vi.fn mocks, no DOM dependency).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertPipelineRun } from "./route";

// ── Mock @neondatabase/serverless ─────────────────────────────────────────────

const mockSql = vi.fn();

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBroadcastNdjson(
  names: string[],
  status = 200,
  headers: Record<string, string> = {},
) {
  const lines = names.map((name) =>
    JSON.stringify({ tour: { id: "t1", name, slug: name.toLowerCase() } }),
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => headers[key] ?? null },
    text: () => Promise.resolve(lines.join("\n")),
  };
}

function makeRequest(authHeader?: string) {
  return {
    headers: { get: (key: string) => (key === "authorization" ? (authHeader ?? null) : null) },
  } as unknown as import("next/server").NextRequest;
}

// ── upsertPipelineRun ─────────────────────────────────────────────────────────

describe("upsertPipelineRun", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSql.mockResolvedValue([]);
  });

  it("calls sql with status=success and lastSuccessAt set", async () => {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon("dummy");

    await upsertPipelineRun(sql, {
      status: "success",
      lastSuccessAt: new Date("2026-05-20T12:00:00Z"),
      recordCount: 5,
      error: null,
    });

    expect(mockSql).toHaveBeenCalledOnce();
  });

  it("calls sql with status=failed and error message", async () => {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon("dummy");

    await upsertPipelineRun(sql, {
      status: "failed",
      lastSuccessAt: null,
      recordCount: null,
      error: "Lichess API returned 503",
    });

    expect(mockSql).toHaveBeenCalledOnce();
  });
});

// ── GET handler ───────────────────────────────────────────────────────────────

describe("GET /api/cron/chess-health", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSql.mockResolvedValue([]);
    vi.unstubAllEnvs();
  });

  it("returns 401 when CRON_SECRET is set and Authorization header is missing", async () => {
    vi.stubEnv("CRON_SECRET", "secret123");
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET is set and Authorization header is wrong", async () => {
    vi.stubEnv("CRON_SECRET", "secret123");
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    const { GET } = await import("./route");
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("proceeds when CRON_SECRET matches Authorization header", async () => {
    vi.stubEnv("CRON_SECRET", "secret123");
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        makeBroadcastNdjson(["Norway Chess 2026"]) as unknown as Response,
      );

    const { GET } = await import("./route");
    const res = await GET(makeRequest("Bearer secret123"));
    expect(res.status).toBe(200);

    fetchSpy.mockRestore();
  });

  it("proceeds without auth check when CRON_SECRET is unset", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        makeBroadcastNdjson(["Norway Chess 2026"]) as unknown as Response,
      );

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    fetchSpy.mockRestore();
  });

  it("on successful Lichess response, upserts success and returns broadcastCount", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        makeBroadcastNdjson(["Norway Chess 2026", "World Blitz 2026"]) as unknown as Response,
      );

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.broadcastCount).toBe(2);
    expect(body.activeTournament).toBe("Norway Chess 2026");
    expect(mockSql).toHaveBeenCalledOnce();

    fetchSpy.mockRestore();
  });

  it("on Lichess network error, upserts failed status and returns ok:false", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("ECONNREFUSED");
    expect(mockSql).toHaveBeenCalledOnce();

    fetchSpy.mockRestore();
  });

  it("on Lichess non-200 response, upserts failed status with HTTP status code", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        makeBroadcastNdjson([], 429) as unknown as Response,
      );

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("429");
    expect(mockSql).toHaveBeenCalledOnce();

    fetchSpy.mockRestore();
  });

  it("skips DB write when X-RateLimit-Remaining is below threshold", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        makeBroadcastNdjson(["Norway Chess 2026"], 200, {
          "X-RateLimit-Remaining": "3",
        }) as unknown as Response,
      );

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe(true);
    expect(mockSql).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("returns 500 when no Postgres connection string is configured", async () => {
    // No POSTGRES_URL or POSTGRES_URL_NON_POOLING set.
    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
