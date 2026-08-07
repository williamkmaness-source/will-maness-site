import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock @neondatabase/serverless ─────────────────────────────────────────────
// mockSql is a tagged-template-literal-compatible function; tests override its
// return value per-case via mockSql.mockResolvedValue(...). Same pattern as
// src/lib/vendor-feed/feed-queries.test.ts.

const mockSql = vi.fn();

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const scoreRow = {
  snapshot_week: "2026-08-03",
  feature_name: "key_mode",
  feature_value: "C major",
  count: "27",
  rating: "hot",
};

const trackRow = {
  snapshot_week: "2026-08-03",
  rank: 1,
  title: "Some Song",
  artist: "Some Artist",
  key_mode: "C major",
  bpm_range: "120–139",
  song_structure: "5 sections",
  chord_flavor: "single key",
};

async function loadFreshModule() {
  return import("./music-queries");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getLatestFeatureScores", () => {
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

    const { getLatestFeatureScores } = await loadFreshModule();
    await expect(getLatestFeatureScores()).rejects.toThrow(
      "No Postgres connection string found"
    );
  });

  it("returns null when the pipeline has never scored a week", async () => {
    mockSql.mockResolvedValue([]);

    const { getLatestFeatureScores } = await loadFreshModule();
    expect(await getLatestFeatureScores()).toBeNull();
  });

  it("maps rows and coerces the count to a number", async () => {
    mockSql.mockResolvedValue([scoreRow]);

    const { getLatestFeatureScores } = await loadFreshModule();
    const snapshot = await getLatestFeatureScores();

    expect(snapshot).toEqual({
      snapshotWeek: "2026-08-03",
      scores: [
        {
          featureName: "key_mode",
          featureValue: "C major",
          count: 27,
          rating: "hot",
        },
      ],
    });
    // Neon returns bigint-ish counts as strings; the mapping must not leak that.
    expect(typeof snapshot?.scores[0].count).toBe("number");
  });

  it("drops rows whose feature_name is not one of the four dimensions", async () => {
    mockSql.mockResolvedValue([scoreRow, { ...scoreRow, feature_name: "loudness" }]);

    const { getLatestFeatureScores } = await loadFreshModule();
    const snapshot = await getLatestFeatureScores();

    expect(snapshot?.scores).toHaveLength(1);
    expect(snapshot?.scores[0].featureName).toBe("key_mode");
  });

  it("drops rows whose rating is outside the four bands", async () => {
    // `music_feature_scores.rating` is an unconstrained text column, so a bad value
    // would otherwise reach FeatureRatingBadge and render an unstyled, unlabelled pill.
    mockSql.mockResolvedValue([
      scoreRow,
      { ...scoreRow, feature_value: "D minor", rating: "lukewarm" },
    ]);

    const { getLatestFeatureScores } = await loadFreshModule();
    const snapshot = await getLatestFeatureScores();

    expect(snapshot?.scores).toHaveLength(1);
    expect(snapshot?.scores[0].featureValue).toBe("C major");
  });

  it("still reports the snapshot week when every row is discarded", async () => {
    mockSql.mockResolvedValue([{ ...scoreRow, rating: "lukewarm" }]);

    const { getLatestFeatureScores } = await loadFreshModule();
    const snapshot = await getLatestFeatureScores();

    expect(snapshot?.snapshotWeek).toBe("2026-08-03");
    expect(snapshot?.scores).toEqual([]);
  });
});

describe("findScore", () => {
  it("returns null when there is no snapshot", async () => {
    const { findScore } = await loadFreshModule();
    expect(findScore(null, "key_mode", "C major")).toBeNull();
  });

  it("returns null for a value the pipeline has never seen", async () => {
    const { findScore } = await loadFreshModule();
    const snapshot = {
      snapshotWeek: "2026-08-03",
      scores: [
        { featureName: "key_mode" as const, featureValue: "C major", count: 27, rating: "hot" as const },
      ],
    };

    expect(findScore(snapshot, "key_mode", "F# minor")).toBeNull();
  });

  it("does not match the right value under the wrong feature name", async () => {
    const { findScore } = await loadFreshModule();
    const snapshot = {
      snapshotWeek: "2026-08-03",
      scores: [
        { featureName: "key_mode" as const, featureValue: "C major", count: 27, rating: "hot" as const },
      ],
    };

    expect(findScore(snapshot, "chord_flavor", "C major")).toBeNull();
    expect(findScore(snapshot, "key_mode", "C major")?.count).toBe(27);
  });
});

describe("getLatestTop100", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, POSTGRES_URL: "postgres://fake" };
    mockSql.mockReset();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.resetModules();
  });

  it("returns null when no week has been scraped", async () => {
    mockSql.mockResolvedValue([]);

    const { getLatestTop100 } = await loadFreshModule();
    expect(await getLatestTop100()).toBeNull();
  });

  it("keeps tracks that have not been feature-extracted yet, with null features", async () => {
    // The LEFT JOIN is deliberate: a scraped-but-unextracted track must still occupy
    // its rank rather than vanishing from the dashboard.
    mockSql.mockResolvedValue([
      trackRow,
      {
        ...trackRow,
        rank: 2,
        title: "Unextracted",
        key_mode: null,
        bpm_range: null,
        song_structure: null,
        chord_flavor: null,
      },
    ]);

    const { getLatestTop100 } = await loadFreshModule();
    const snapshot = await getLatestTop100();

    expect(snapshot?.snapshotWeek).toBe("2026-08-03");
    expect(snapshot?.tracks).toHaveLength(2);
    expect(snapshot?.tracks[1].features).toEqual({
      key_mode: null,
      bpm_range: null,
      song_structure: null,
      chord_flavor: null,
    });
  });

  it("coerces the rank to a number", async () => {
    mockSql.mockResolvedValue([{ ...trackRow, rank: "1" }]);

    const { getLatestTop100 } = await loadFreshModule();
    const snapshot = await getLatestTop100();

    expect(snapshot?.tracks[0].rank).toBe(1);
  });
});
