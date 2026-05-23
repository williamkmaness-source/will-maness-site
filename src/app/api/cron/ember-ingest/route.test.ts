// Tests for the ember-ingest cron handler (issue #93).
// Exercises runIngest and the GET handler auth + error paths without hitting Neon.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runIngest } from "./route";

// ── Mock @neondatabase/serverless ─────────────────────────────────────────────

const mockSql = vi.fn();

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string) {
  return {
    headers: { get: (key: string) => (key === "authorization" ? (authHeader ?? null) : null) },
  } as unknown as import("next/server").NextRequest;
}

// ── runIngest ─────────────────────────────────────────────────────────────────

describe("runIngest", () => {
  beforeEach(() => {
    mockSql.mockReset();
  });

  it("inserts a cluster and upserts county conditions, returning clusterId", async () => {
    // First call: DELETE old stub rows
    mockSql.mockResolvedValueOnce([]);
    // Second call: INSERT cluster → returns id
    mockSql.mockResolvedValueOnce([{ id: 42 }]);
    // Third call: UPSERT county conditions
    mockSql.mockResolvedValueOnce([]);

    const { neon } = await import("@neondatabase/serverless");
    const sql = neon("dummy");

    const result = await runIngest(sql);

    expect(result.clusterId).toBe(42);
    expect(result.conditionsUpserted).toBe(true);
    expect(mockSql).toHaveBeenCalledTimes(3);
  });
});

// ── GET handler ───────────────────────────────────────────────────────────────

describe("GET /api/cron/ember-ingest", () => {
  beforeEach(() => {
    mockSql.mockReset();
    vi.unstubAllEnvs();
  });

  it("returns 401 when CRON_SECRET is set and Authorization header is missing", async () => {
    vi.stubEnv("CRON_SECRET", "secret123");
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET is set and Authorization is wrong", async () => {
    vi.stubEnv("CRON_SECRET", "secret123");
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    const { GET } = await import("./route");
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 500 when no Postgres connection string is configured", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("returns ok:true with clusterId on success", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    mockSql.mockResolvedValueOnce([]); // DELETE old stubs
    mockSql.mockResolvedValueOnce([{ id: 7 }]);
    mockSql.mockResolvedValueOnce([]);

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.clusterId).toBe(7);
    expect(body.conditionsUpserted).toBe(true);
  });

  it("returns ok:false with error message when ingest throws", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    mockSql.mockRejectedValueOnce(new Error("relation does not exist"));

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Ingest failed");
  });

  it("proceeds without auth check when CRON_SECRET is unset", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    mockSql.mockResolvedValueOnce([]); // DELETE old stubs
    mockSql.mockResolvedValueOnce([{ id: 1 }]);
    mockSql.mockResolvedValueOnce([]);

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
