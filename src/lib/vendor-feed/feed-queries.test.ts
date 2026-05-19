import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FeedEntity } from "./feed-queries";

// ── Mock @neondatabase/serverless ─────────────────────────────────────────────
// mockSql is a tagged-template-literal-compatible function; tests override its
// return value per-suite via mockSql.mockResolvedValue(...).

const mockSql = vi.fn();

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const featureLaunchRow = {
  entity_type: "feature_launch",
  id: "1",
  company: "Prefect",
  title: "Prefect 3.0",
  description: "Redesigned scheduling engine.",
  date: "2025-01-15",
  source_url: "https://prefect.io/blog/v3",
  created_at: "2025-01-15T10:00:00Z",
};

const pricingChangeRow = {
  entity_type: "pricing_change",
  id: "2",
  company: "Airbyte",
  title: "Airbyte pricing update",
  description: "Moved to usage-based pricing.",
  date: null,
  source_url: "https://airbyte.com/pricing",
  created_at: "2025-02-01T08:00:00Z",
};

const partnershipRow = {
  entity_type: "partnership",
  id: "3",
  company: "Fivetran",
  title: "Snowflake",
  description: "Native Snowflake integration.",
  date: "2025-03-10",
  source_url: "https://fivetran.com/blog/snowflake",
  created_at: "2025-03-10T12:00:00Z",
};

const archShiftRow = {
  entity_type: "architectural_shift",
  id: "4",
  company: "dbt Labs",
  title: "Celery → Ray",
  description: "Migrated core infrastructure to Ray.",
  date: "2025-04-01",
  source_url: "https://www.getdbt.com/blog/ray",
  created_at: "2025-04-01T09:00:00Z",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadFreshModule() {
  // Re-import after mocking to get the latest module state.
  const mod = await import("./feed-queries");
  return mod;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getFeedEntities", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, POSTGRES_URL: "postgres://fake" };
    mockSql.mockReset();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.resetModules();
  });

  it("throws when no Postgres connection string is configured", async () => {
    process.env = { ...OLD_ENV };
    delete process.env.POSTGRES_URL;
    delete process.env.POSTGRES_URL_NON_POOLING;

    const { getFeedEntities } = await loadFreshModule();
    await expect(getFeedEntities()).rejects.toThrow("No Postgres connection string found");
  });

  it("maps entity rows to correctly-shaped FeedEntity objects", async () => {
    mockSql.mockResolvedValue([featureLaunchRow, pricingChangeRow]);

    const { getFeedEntities } = await loadFreshModule();
    const result = await getFeedEntities();

    expect(result).toHaveLength(2);

    const launch = result.find((e) => e.entityType === "feature_launch");
    expect(launch).toBeDefined();
    expect(launch!.company).toBe("Prefect");
    expect(launch!.title).toBe("Prefect 3.0");
    expect(launch!.description).toBe("Redesigned scheduling engine.");
    expect(launch!.sourceUrl).toBe("https://prefect.io/blog/v3");
    expect(launch!.createdAt).toBe("2025-01-15T10:00:00Z");
  });

  it("builds entity ID as {entity_type}-{id}", async () => {
    mockSql.mockResolvedValue([featureLaunchRow]);

    const { getFeedEntities } = await loadFreshModule();
    const [entity] = await getFeedEntities();
    expect(entity.id).toBe("feature_launch-1");
  });

  it("sets date to null when DB column is null", async () => {
    mockSql.mockResolvedValue([pricingChangeRow]);

    const { getFeedEntities } = await loadFreshModule();
    const [entity] = await getFeedEntities();
    expect(entity.date).toBeNull();
  });

  it("preserves non-null date strings unchanged", async () => {
    mockSql.mockResolvedValue([featureLaunchRow]);

    const { getFeedEntities } = await loadFreshModule();
    const [entity] = await getFeedEntities();
    expect(entity.date).toBe("2025-01-15");
  });

  it("maps all four entity types correctly", async () => {
    mockSql.mockResolvedValue([
      featureLaunchRow,
      pricingChangeRow,
      partnershipRow,
      archShiftRow,
    ]);

    const { getFeedEntities } = await loadFreshModule();
    const result = await getFeedEntities();

    const types = result.map((e) => e.entityType);
    expect(types).toContain("feature_launch");
    expect(types).toContain("pricing_change");
    expect(types).toContain("partnership");
    expect(types).toContain("architectural_shift");
  });

  it("maps snake_case DB columns to camelCase FeedEntity fields", async () => {
    mockSql.mockResolvedValue([partnershipRow]);

    const { getFeedEntities } = await loadFreshModule();
    const [entity] = await getFeedEntities();

    // source_url → sourceUrl; entity_type → entityType; created_at → createdAt
    expect((entity as unknown as Record<string, unknown>)["source_url"]).toBeUndefined();
    expect((entity as unknown as Record<string, unknown>)["entity_type"]).toBeUndefined();
    expect((entity as unknown as Record<string, unknown>)["created_at"]).toBeUndefined();
    expect(entity.sourceUrl).toBe("https://fivetran.com/blog/snowflake");
    expect(entity.entityType).toBe("partnership");
    expect(entity.createdAt).toBe("2025-03-10T12:00:00Z");
  });

  it("returns an empty array when the query returns no rows", async () => {
    mockSql.mockResolvedValue([]);

    const { getFeedEntities } = await loadFreshModule();
    const result = await getFeedEntities();
    expect(result).toEqual([]);
  });

  it("returns entities in the order the DB delivers them", async () => {
    mockSql.mockResolvedValue([archShiftRow, partnershipRow, featureLaunchRow]);

    const { getFeedEntities } = await loadFreshModule();
    const result = await getFeedEntities();

    expect(result[0].id).toBe("architectural_shift-4");
    expect(result[1].id).toBe("partnership-3");
    expect(result[2].id).toBe("feature_launch-1");
  });

  it("result objects satisfy the FeedEntity interface shape", async () => {
    mockSql.mockResolvedValue([featureLaunchRow]);

    const { getFeedEntities } = await loadFreshModule();
    const [entity]: FeedEntity[] = await getFeedEntities();

    // TypeScript type check at test time + runtime presence check
    const keys: (keyof FeedEntity)[] = [
      "id", "entityType", "company", "title", "description",
      "date", "sourceUrl", "createdAt",
    ];
    for (const key of keys) {
      expect(key in entity).toBe(true);
    }
  });
});
