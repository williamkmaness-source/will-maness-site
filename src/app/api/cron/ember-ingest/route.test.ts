// Tests for the ember-ingest cron handler (issues #93, #95, #96, #97, #98).
// Mocks Neon driver, firms-client, cluster-engine, weather-client, ember-scoring, and ember-briefing.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runIngest } from "./route";
import type { FirmsDetection } from "@/lib/ember/firms-client";
import type { FireClusterInput } from "@/lib/ember/cluster-engine";
import type { WeatherObservation } from "@/lib/ember/weather-client";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFetchFirms = vi.fn<(key: string) => Promise<FirmsDetection[]>>();
const mockCluster = vi.fn<(dets: FirmsDetection[]) => FireClusterInput[]>();
const mockFetchWeather = vi.fn<
  (lat: number, lng: number, token: string, r?: number) => Promise<WeatherObservation | null>
>();

vi.mock("@/lib/ember/firms-client", () => ({
  fetchFirmsDetections: (...args: Parameters<typeof mockFetchFirms>) =>
    mockFetchFirms(...args),
  LAKE_TAHOE_BASIN_BBOX: { west: -120.5, south: 38.7, east: -119.5, north: 39.4 },
  meetsConfidenceThreshold: vi.fn(),
  isWithinBbox: vi.fn(),
}));

vi.mock("@/lib/ember/cluster-engine", () => ({
  clusterDetections: (...args: Parameters<typeof mockCluster>) => mockCluster(...args),
}));

vi.mock("@/lib/ember/weather-client", () => ({
  fetchWeatherForLocation: (lat: number, lng: number, token: string, r?: number) =>
    mockFetchWeather(lat, lng, token, r),
  evaluateRedFlag: vi.fn().mockReturnValue(false),
  degreesToCardinal: vi.fn().mockReturnValue("SW"),
  LAKE_TAHOE_BASIN_CENTROID: { lat: 39.05, lng: -120.05 },
}));

vi.mock("@/lib/ember/ember-scoring", () => ({
  computeRiskScore: vi.fn().mockReturnValue(55),
  assignTier: vi.fn().mockReturnValue("Watch"),
  TREND_MATCH_RADIUS_KM: 10,
}));

const mockGenerateBriefing = vi.fn<() => Promise<{ currentSituation: string; weatherContext: string; outlook: string } | null>>();

vi.mock("@/lib/ember/ember-briefing", () => ({
  generateBriefing: () => mockGenerateBriefing(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(),
}));

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

function makeCluster(overrides: Partial<FireClusterInput> = {}): FireClusterInput {
  return {
    lat: 39.1,
    lng: -120.1,
    frp: 250,
    detectionCount: 3,
    detectedAt: new Date("2026-05-23T10:00:00Z"),
    ...overrides,
  };
}

function makeWeather(): WeatherObservation {
  return {
    stationId: "KCOR",
    windSpeedMph: 12.5,
    windDirectionDeg: 225,
    windGustMph: 18.0,
    humidityPct: 28,
    temperatureF: 78,
    precip24hIn: 0.0,
    observedAt: "2026-05-23T10:00:00Z",
  };
}

// ── runIngest ─────────────────────────────────────────────────────────────────

describe("runIngest", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockFetchFirms.mockReset();
    mockCluster.mockReset();
    mockFetchWeather.mockReset();
    mockGenerateBriefing.mockReset();
    mockGenerateBriefing.mockResolvedValue(null);
    mockSql.mockResolvedValue([]);
  });

  it("inserts one cluster, updates weather, scores it, and upserts county conditions", async () => {
    mockFetchFirms.mockResolvedValue([]);
    mockCluster.mockReturnValue([makeCluster()]);
    mockSql
      .mockResolvedValueOnce([])           // SELECT prior clusters
      .mockResolvedValueOnce([])           // DELETE
      .mockResolvedValueOnce([{ id: 1 }]) // INSERT cluster RETURNING id
      .mockResolvedValueOnce([])           // UPDATE weather
      .mockResolvedValueOnce([])           // UPDATE risk_score/tier
      .mockResolvedValueOnce([]);          // UPSERT county conditions
    mockFetchWeather.mockResolvedValue(makeWeather());

    const { neon } = await import("@neondatabase/serverless");
    const sql = neon("dummy");

    const result = await runIngest(sql, "firms-key", "synoptic-key");

    expect(result.clusterCount).toBe(1);
    expect(result.weatherUpdated).toBe(1);
    expect(result.scored).toBe(1);
    expect(result.briefed).toBe(0);
    expect(result.firmsError).toBeUndefined();
  });

  it("inserts zero clusters and still upserts county conditions", async () => {
    mockFetchFirms.mockResolvedValue([]);
    mockCluster.mockReturnValue([]);
    mockSql
      .mockResolvedValueOnce([]) // SELECT prior clusters
      .mockResolvedValueOnce([]) // DELETE
      .mockResolvedValueOnce([]); // UPSERT county conditions
    mockFetchWeather.mockResolvedValue(makeWeather());

    const { neon } = await import("@neondatabase/serverless");
    const sql = neon("dummy");

    const result = await runIngest(sql, "firms-key", "synoptic-key");

    expect(result.clusterCount).toBe(0);
    expect(result.weatherUpdated).toBe(0);
    expect(result.scored).toBe(0);
    expect(result.briefed).toBe(0);
    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it("scores cluster even when weather returns null", async () => {
    mockFetchFirms.mockResolvedValue([]);
    mockCluster.mockReturnValue([makeCluster()]);
    mockSql
      .mockResolvedValueOnce([])           // SELECT prior clusters
      .mockResolvedValueOnce([])           // DELETE
      .mockResolvedValueOnce([{ id: 2 }]) // INSERT
      .mockResolvedValueOnce([])           // UPDATE risk_score/tier (no weather UPDATE)
      .mockResolvedValueOnce([]);          // UPSERT county conditions
    mockFetchWeather
      .mockResolvedValueOnce(null)          // cluster weather → null
      .mockResolvedValueOnce(makeWeather()); // county weather → ok

    const { neon } = await import("@neondatabase/serverless");
    const sql = neon("dummy");

    const result = await runIngest(sql, "firms-key", "synoptic-key");

    expect(result.weatherUpdated).toBe(0);
    expect(result.scored).toBe(1); // scored with null weather (neutral defaults)
  });

  it("catches a per-cluster weather error and still scores that cluster", async () => {
    mockFetchFirms.mockResolvedValue([]);
    mockCluster.mockReturnValue([makeCluster(), makeCluster({ lat: 39.2 })]);
    mockSql
      .mockResolvedValueOnce([])           // SELECT prior clusters
      .mockResolvedValueOnce([])           // DELETE
      .mockResolvedValueOnce([{ id: 3 }]) // INSERT cluster 1
      .mockResolvedValueOnce([{ id: 4 }]) // INSERT cluster 2
      // weather: cluster 1 throws, cluster 2 succeeds (parallel — consumed in resolve order)
      .mockResolvedValueOnce([])           // UPDATE weather cluster 2
      .mockResolvedValueOnce([])           // UPDATE risk_score/tier cluster 1
      .mockResolvedValueOnce([])           // UPDATE risk_score/tier cluster 2
      .mockResolvedValueOnce([]);          // UPSERT county conditions
    mockFetchWeather
      .mockRejectedValueOnce(new Error("timeout")) // cluster 1 weather fails
      .mockResolvedValueOnce(makeWeather())         // cluster 2 weather ok
      .mockResolvedValueOnce(makeWeather());        // county weather ok

    const { neon } = await import("@neondatabase/serverless");
    const sql = neon("dummy");

    const result = await runIngest(sql, "firms-key", "synoptic-key");

    expect(result.clusterCount).toBe(2);
    expect(result.weatherUpdated).toBe(1);
    expect(result.scored).toBe(2);
  });

  it("catches a FIRMS fetch error and returns firmsError in result", async () => {
    mockFetchFirms.mockRejectedValue(new Error("FIRMS timeout"));
    mockCluster.mockReturnValue([]);
    mockSql
      .mockResolvedValueOnce([]) // SELECT prior clusters
      .mockResolvedValueOnce([]) // DELETE
      .mockResolvedValueOnce([]); // UPSERT county conditions
    mockFetchWeather.mockResolvedValue(makeWeather());

    const { neon } = await import("@neondatabase/serverless");
    const sql = neon("dummy");

    const result = await runIngest(sql, "firms-key", "synoptic-key");

    expect(result.clusterCount).toBe(0);
    expect(result.firmsError).toBe("FIRMS timeout");
  });

  it("generates a briefing for Action-tier clusters when ANTHROPIC_API_KEY is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const { assignTier } = await import("@/lib/ember/ember-scoring");
    vi.mocked(assignTier).mockReturnValue("Action");

    mockFetchFirms.mockResolvedValue([]);
    mockCluster.mockReturnValue([makeCluster()]);
    mockSql
      .mockResolvedValueOnce([])           // SELECT prior clusters
      .mockResolvedValueOnce([])           // DELETE
      .mockResolvedValueOnce([{ id: 7 }]) // INSERT cluster RETURNING id
      .mockResolvedValueOnce([])           // UPDATE weather
      .mockResolvedValueOnce([])           // UPDATE risk_score/tier
      .mockResolvedValueOnce([])           // UPDATE briefing
      .mockResolvedValueOnce([]);          // UPSERT county conditions
    mockFetchWeather.mockResolvedValue(makeWeather());
    mockGenerateBriefing.mockResolvedValue({
      currentSituation: "Active burning detected.",
      weatherContext: "Dry and windy conditions.",
      outlook: "Risk remains elevated.",
    });

    const { neon } = await import("@neondatabase/serverless");
    const sql = neon("dummy");

    const result = await runIngest(sql, "firms-key", "synoptic-key");

    expect(result.briefed).toBe(1);
    expect(mockGenerateBriefing).toHaveBeenCalledOnce();

    vi.mocked(assignTier).mockReturnValue("Watch");
    vi.unstubAllEnvs();
  });

  it("skips briefing when ANTHROPIC_API_KEY is not set", async () => {
    const { assignTier } = await import("@/lib/ember/ember-scoring");
    vi.mocked(assignTier).mockReturnValue("Action");

    mockFetchFirms.mockResolvedValue([]);
    mockCluster.mockReturnValue([makeCluster()]);
    mockSql
      .mockResolvedValueOnce([])           // SELECT prior clusters
      .mockResolvedValueOnce([])           // DELETE
      .mockResolvedValueOnce([{ id: 8 }]) // INSERT
      .mockResolvedValueOnce([])           // UPDATE weather
      .mockResolvedValueOnce([])           // UPDATE risk_score/tier
      .mockResolvedValueOnce([]);          // UPSERT county conditions
    mockFetchWeather.mockResolvedValue(makeWeather());

    const { neon } = await import("@neondatabase/serverless");
    const sql = neon("dummy");

    const result = await runIngest(sql, "firms-key", "synoptic-key");

    expect(result.briefed).toBe(0);
    expect(mockGenerateBriefing).not.toHaveBeenCalled();

    vi.mocked(assignTier).mockReturnValue("Watch");
  });

  it("passes prior cluster data to scoring for trend computation", async () => {
    const { computeRiskScore } = await import("@/lib/ember/ember-scoring");
    const mockComputeScore = vi.mocked(computeRiskScore);

    // Prior cluster at same location as the new one
    mockFetchFirms.mockResolvedValue([]);
    mockCluster.mockReturnValue([makeCluster({ lat: 39.1, lng: -120.1, frp: 300 })]);
    mockSql
      .mockResolvedValueOnce([{ lat: 39.1, lng: -120.1, frp: 150 }]) // prior cluster
      .mockResolvedValueOnce([])                                       // DELETE
      .mockResolvedValueOnce([{ id: 10 }])                            // INSERT
      .mockResolvedValueOnce([])                                       // UPDATE weather
      .mockResolvedValueOnce([])                                       // UPDATE score
      .mockResolvedValueOnce([]);                                      // county UPSERT
    mockFetchWeather.mockResolvedValue(makeWeather());

    const { neon } = await import("@neondatabase/serverless");
    const sql = neon("dummy");

    await runIngest(sql, "firms-key", "synoptic-key");

    // priorFrp should be 150 (the nearby prior cluster's FRP)
    expect(mockComputeScore).toHaveBeenCalledWith(
      300,
      expect.anything(),
      expect.anything(),
      expect.any(Boolean),
      150
    );
  });
});

// ── GET handler ───────────────────────────────────────────────────────────────

describe("GET /api/cron/ember-ingest", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockFetchFirms.mockReset();
    mockCluster.mockReset();
    mockFetchWeather.mockReset();
    mockGenerateBriefing.mockReset();
    mockGenerateBriefing.mockResolvedValue(null);
    vi.unstubAllEnvs();
  });

  it("returns 401 when CRON_SECRET is set and Authorization header is missing", async () => {
    vi.stubEnv("CRON_SECRET", "secret123");
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    vi.stubEnv("FIRMS_API_KEY", "firms-key");
    vi.stubEnv("SYNOPTIC_API_KEY", "synoptic-key");

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET is set and Authorization is wrong", async () => {
    vi.stubEnv("CRON_SECRET", "secret123");
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    vi.stubEnv("FIRMS_API_KEY", "firms-key");
    vi.stubEnv("SYNOPTIC_API_KEY", "synoptic-key");

    const { GET } = await import("./route");
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 500 when no Postgres connection string is configured", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("returns 500 when FIRMS_API_KEY is not configured", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("returns 500 when SYNOPTIC_API_KEY is not configured", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    vi.stubEnv("FIRMS_API_KEY", "firms-key");

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("returns ok:true with clusterCount, weatherUpdated, scored, and briefed on success", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    vi.stubEnv("FIRMS_API_KEY", "firms-key");
    vi.stubEnv("SYNOPTIC_API_KEY", "synoptic-key");

    mockFetchFirms.mockResolvedValue([]);
    mockCluster.mockReturnValue([makeCluster()]);
    mockSql
      .mockResolvedValueOnce([])           // SELECT prior clusters
      .mockResolvedValueOnce([])           // DELETE
      .mockResolvedValueOnce([{ id: 5 }]) // INSERT cluster RETURNING id
      .mockResolvedValueOnce([])           // UPDATE weather
      .mockResolvedValueOnce([])           // UPDATE risk_score/tier
      .mockResolvedValueOnce([])           // UPSERT county conditions
      .mockResolvedValueOnce([]);          // UPSERT pipeline_runs success
    mockFetchWeather.mockResolvedValue(makeWeather());

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.clusterCount).toBe(1);
    expect(body.weatherUpdated).toBe(1);
    expect(body.scored).toBe(1);
    expect(body.briefed).toBe(0);
  });

  it("returns ok:false with error message when SQL throws", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    vi.stubEnv("FIRMS_API_KEY", "firms-key");
    vi.stubEnv("SYNOPTIC_API_KEY", "synoptic-key");

    mockFetchFirms.mockResolvedValue([]);
    mockCluster.mockReturnValue([]);
    mockSql.mockRejectedValue(new Error("relation does not exist"));

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Ingest failed");
  });

  it("proceeds without auth check when CRON_SECRET is unset", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://dummy");
    vi.stubEnv("FIRMS_API_KEY", "firms-key");
    vi.stubEnv("SYNOPTIC_API_KEY", "synoptic-key");

    mockFetchFirms.mockResolvedValue([]);
    mockCluster.mockReturnValue([]);
    mockSql.mockResolvedValue([]);
    mockFetchWeather.mockResolvedValue(null);

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
