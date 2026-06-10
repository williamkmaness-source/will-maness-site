import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSql = vi.fn();

vi.mock("@neondatabase/serverless", () => ({
  neon: () => mockSql,
}));

function makeRequest(department?: string): Request {
  const url = department
    ? `http://localhost/api/311-department-breakdown?department=${encodeURIComponent(department)}`
    : "http://localhost/api/311-department-breakdown";
  return new Request(url);
}

describe("GET /api/311-department-breakdown", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mockSql.mockReset();
  });

  it("returns 400 when department param is missing", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/department/i);
  });

  it("returns 503 when POSTGRES_URL is not set", async () => {
    vi.stubEnv("POSTGRES_URL", "");
    vi.stubEnv("POSTGRES_URL_NON_POOLING", "");
    const { GET } = await import("./route");
    const res = await GET(makeRequest("Inspectional Services"));
    expect(res.status).toBe(503);
  });

  it("returns top 10 reasons sorted by total volume descending", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    mockSql.mockResolvedValueOnce([
      { reason: "Pothole", opened: 80, closed: 60 },
      { reason: "Street Light", opened: 40, closed: 50 },
      { reason: "Graffiti", opened: 20, closed: 15 },
    ]);

    const { GET } = await import("./route");
    const res = await GET(makeRequest("Public Works"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.department).toBe("Public Works");
    expect(body.reasons).toHaveLength(3);
    expect(body.reasons[0].reason).toBe("Pothole");
    expect(body.reasons[0].opened).toBe(80);
    expect(body.reasons[0].closed).toBe(60);
  });

  it("returns an empty reasons array when no data found", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    mockSql.mockResolvedValueOnce([]);

    const { GET } = await import("./route");
    const res = await GET(makeRequest("Animal Control"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.reasons).toEqual([]);
  });

  it("returns 502 when SQL throws", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    mockSql.mockRejectedValue(new Error("connection refused"));

    const { GET } = await import("./route");
    const res = await GET(makeRequest("Inspectional Services"));
    expect(res.status).toBe(502);
  });

  it("uses POSTGRES_URL_NON_POOLING when POSTGRES_URL is absent", async () => {
    vi.stubEnv("POSTGRES_URL", "");
    vi.stubEnv("POSTGRES_URL_NON_POOLING", "postgres://fallback");
    mockSql.mockResolvedValueOnce([]);

    const { GET } = await import("./route");
    const res = await GET(makeRequest("Boston Police Department"));
    expect(res.status).toBe(200);
  });
});
