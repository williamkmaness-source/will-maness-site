import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSql = vi.fn();

vi.mock("@neondatabase/serverless", () => ({
  neon: () => mockSql,
}));

describe("GET /api/311-departments", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mockSql.mockReset();
  });

  it("returns 503 when POSTGRES_URL is not set", async () => {
    vi.stubEnv("POSTGRES_URL", "");
    vi.stubEnv("POSTGRES_URL_NON_POOLING", "");
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("returns departments sorted by flag status (red first, then yellow, then green)", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    // Two departments: dept A has 3 weeks (stressed pattern → yellow),
    // dept B has 3 weeks (calm pattern → green).
    mockSql
      .mockResolvedValueOnce([
        // Dept A: stressed at the end of the window (opened > closed, median rising)
        { week: "2026-05-05", department: "Dept A", opened: 100, closed: 110, median_days: 5.0 },
        { week: "2026-05-12", department: "Dept A", opened: 90, closed: 100, median_days: 4.5 },
        { week: "2026-05-19", department: "Dept A", opened: 130, closed: 100, median_days: 6.5 },
        // Dept B: calm throughout
        { week: "2026-05-05", department: "Dept B", opened: 80, closed: 100, median_days: 3.0 },
        { week: "2026-05-12", department: "Dept B", opened: 70, closed: 90, median_days: 2.8 },
        { week: "2026-05-19", department: "Dept B", opened: 75, closed: 95, median_days: 2.5 },
      ])
      .mockResolvedValueOnce([{ last_success_at: "2026-05-19T06:00:00Z" }]);

    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalCount).toBe(2);
    expect(body.departments[0].department).toBe("Dept A");
    expect(body.departments[0].status).toBe("yellow");
    expect(body.departments[0].tooltip.length).toBeGreaterThan(0);
    expect(body.departments[1].department).toBe("Dept B");
    expect(body.departments[1].status).toBe("green");
    expect(body.lastUpdated).toBe("2026-05-19T06:00:00Z");
  });

  it("returns flaggedCount reflecting non-green departments", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    mockSql
      .mockResolvedValueOnce([
        { week: "2026-05-05", department: "X", opened: 100, closed: 90, median_days: 5.0 },
        { week: "2026-05-12", department: "X", opened: 120, closed: 90, median_days: 6.0 },
        { week: "2026-05-19", department: "X", opened: 130, closed: 80, median_days: 7.0 },
      ])
      .mockResolvedValueOnce([{ last_success_at: null }]);

    const { GET } = await import("./route");
    const body = await (await GET()).json();
    expect(body.flaggedCount).toBe(1);
    expect(body.departments[0].status).toBe("red");
  });

  it("returns 502 when SQL throws", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    mockSql.mockRejectedValue(new Error("connection refused"));

    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(502);
  });
});
