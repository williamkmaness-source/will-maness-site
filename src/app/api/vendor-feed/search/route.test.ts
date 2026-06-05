import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module mock ───────────────────────────────────────────────────────────────

const mockQuery = vi.fn();

vi.mock("@upstash/vector", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Index: vi.fn(function (this: any) { this.query = mockQuery; }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(q?: string): NextRequest {
  const base = "http://localhost/api/vendor-feed/search";
  const url = q ? `${base}?q=${encodeURIComponent(q)}` : base;
  return new NextRequest(url);
}

function makeResult(overrides: {
  raw_page_id?: string;
  company?: string;
  source_url?: string;
  chunk_index?: number;
  data?: string;
}) {
  return {
    id: overrides.raw_page_id ?? "1",
    score: 0.9,
    data: overrides.data ?? "some chunk text",
    metadata: {
      raw_page_id: overrides.raw_page_id ?? "1",
      company: overrides.company ?? "Acme",
      source_url: overrides.source_url ?? "https://acme.com/blog/post-1",
      scraped_at: "2026-06-01T00:00:00Z",
      chunk_index: overrides.chunk_index ?? 0,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/vendor-feed/search", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mockQuery.mockReset();
  });

  it("returns empty matches when q is missing", async () => {
    vi.stubEnv("UPSTASH_VECTOR_REST_URL", "https://vector.example.com");
    vi.stubEnv("UPSTASH_VECTOR_REST_READONLY_TOKEN", "tok");

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns empty matches when q is whitespace-only", async () => {
    vi.stubEnv("UPSTASH_VECTOR_REST_URL", "https://vector.example.com");
    vi.stubEnv("UPSTASH_VECTOR_REST_READONLY_TOKEN", "tok");

    const { GET } = await import("./route");
    const res = await GET(makeRequest("   "));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toEqual([]);
  });

  it("returns 503 when UPSTASH_VECTOR_REST_URL is missing", async () => {
    vi.stubEnv("UPSTASH_VECTOR_REST_READONLY_TOKEN", "tok");

    const { GET } = await import("./route");
    const res = await GET(makeRequest("fire risk"));
    expect(res.status).toBe(503);
  });

  it("returns 503 when UPSTASH_VECTOR_REST_READONLY_TOKEN is missing", async () => {
    vi.stubEnv("UPSTASH_VECTOR_REST_URL", "https://vector.example.com");

    const { GET } = await import("./route");
    const res = await GET(makeRequest("fire risk"));
    expect(res.status).toBe(503);
  });

  it("returns 502 when the Upstash query throws", async () => {
    vi.stubEnv("UPSTASH_VECTOR_REST_URL", "https://vector.example.com");
    vi.stubEnv("UPSTASH_VECTOR_REST_READONLY_TOKEN", "tok");
    mockQuery.mockRejectedValueOnce(new Error("network error"));

    const { GET } = await import("./route");
    const res = await GET(makeRequest("fire risk"));
    expect(res.status).toBe(502);
  });

  it("deduplicates chunks sharing the same source_url", async () => {
    vi.stubEnv("UPSTASH_VECTOR_REST_URL", "https://vector.example.com");
    vi.stubEnv("UPSTASH_VECTOR_REST_READONLY_TOKEN", "tok");

    const url = "https://acme.com/blog/post-1";
    mockQuery.mockResolvedValueOnce([
      makeResult({ source_url: url, chunk_index: 0, data: "chunk A" }),
      makeResult({ source_url: url, chunk_index: 1, data: "chunk B" }),
    ]);

    const { GET } = await import("./route");
    const res = await GET(makeRequest("something"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0].sourceUrl).toBe(url);
    // First chunk wins
    expect(body.matches[0].chunk).toBe("chunk A");
  });

  it("returns correctly shaped matches on the happy path", async () => {
    vi.stubEnv("UPSTASH_VECTOR_REST_URL", "https://vector.example.com");
    vi.stubEnv("UPSTASH_VECTOR_REST_READONLY_TOKEN", "tok");

    mockQuery.mockResolvedValueOnce([
      makeResult({
        raw_page_id: "42",
        company: "Acme",
        source_url: "https://acme.com/blog/post-1",
        data: "relevant excerpt",
      }),
    ]);

    const { GET } = await import("./route");
    const res = await GET(makeRequest("data platform"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0]).toEqual({
      rawPageId: "42",
      sourceUrl: "https://acme.com/blog/post-1",
      company: "Acme",
      chunk: "relevant excerpt",
    });
  });

  it("skips results with no metadata", async () => {
    vi.stubEnv("UPSTASH_VECTOR_REST_URL", "https://vector.example.com");
    vi.stubEnv("UPSTASH_VECTOR_REST_READONLY_TOKEN", "tok");

    mockQuery.mockResolvedValueOnce([
      { id: "1", score: 0.9, data: "text", metadata: undefined },
      makeResult({ raw_page_id: "2", source_url: "https://valid.com/post" }),
    ]);

    const { GET } = await import("./route");
    const res = await GET(makeRequest("query"));
    const body = await res.json();
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0].rawPageId).toBe("2");
  });
});
