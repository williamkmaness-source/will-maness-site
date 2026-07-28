// Tests for the music-analyzer pipeline steps (issue #215).
// Mocks the Neon driver and the Spotify client; no network, no DB.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  snapshotWeekFor,
  runScrape,
  runExtract,
  runScore,
  recordPipelineRun,
} from "./music-pipeline";
import type { SpotifyClient } from "./spotify-client";

const mockSql = vi.fn();

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

type Sql = Parameters<typeof runScore>[0];

async function makeSql(): Promise<Sql> {
  const { neon } = await import("@neondatabase/serverless");
  return neon("dummy") as unknown as Sql;
}

/** The SQL text of the nth call, whitespace-collapsed, for asserting which statement ran. */
function statement(callIndex: number): string {
  const strings = mockSql.mock.calls[callIndex][0] as string[];
  return strings.join(" ? ").replace(/\s+/g, " ").trim();
}

function fakeSpotify(overrides: Partial<SpotifyClient> = {}): SpotifyClient {
  return {
    searchTrack: vi.fn().mockResolvedValue([{ id: "sp1", name: "One", artist: "A" }]),
    getTrackFeatures: vi.fn().mockResolvedValue({
      audioFeatures: { key: 0, mode: 1, tempo: 128 },
      sections: [{ key: 0, mode: 1 }, { key: 0, mode: 1 }, { key: 0, mode: 1 }],
    }),
    ...overrides,
  } as unknown as SpotifyClient;
}

function htmlFetch(html: string): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(html),
  }) as unknown as typeof fetch;
}

const CHART_ROW = `
<ul class="o-chart-results-list-row // lrv-a-unstyle-list">
  <li class="o-chart-results-list__item"><span class="c-label a-font-basic">1</span></li>
  <li class="o-chart-results-list__item">
    <h3 id="title-of-a-story" class="c-title a-font-basic">Choosin&#039; Texas</h3>
    <span class="c-label a-no-trucate"><a href="/artist/x/">Ella Langley</a></span>
  </li>
</ul>`;

describe("snapshotWeekFor", () => {
  it("returns the Monday of the week for a Monday", () => {
    // 2026-07-27 is a Monday.
    expect(snapshotWeekFor(new Date("2026-07-27T10:00:00Z"))).toBe("2026-07-27");
  });

  it("returns the preceding Monday for every other day of that week", () => {
    const days = [
      "2026-07-28T00:00:00Z", // Tue
      "2026-07-29T12:00:00Z", // Wed
      "2026-07-30T23:59:59Z", // Thu
      "2026-07-31T06:00:00Z", // Fri
      "2026-08-01T18:00:00Z", // Sat
      "2026-08-02T23:00:00Z", // Sun
    ];
    for (const day of days) {
      expect(snapshotWeekFor(new Date(day))).toBe("2026-07-27");
    }
  });

  it("rolls Sunday back to the Monday six days earlier, not forward", () => {
    // 2026-08-02 is a Sunday; ISO weeks start Monday, so it belongs to the 07-27 week.
    expect(snapshotWeekFor(new Date("2026-08-02T00:00:00Z"))).toBe("2026-07-27");
  });

  it("crosses month and year boundaries correctly", () => {
    // 2027-01-01 is a Friday → Monday 2026-12-28.
    expect(snapshotWeekFor(new Date("2027-01-01T00:00:00Z"))).toBe("2026-12-28");
  });

  it("is stable regardless of time of day", () => {
    expect(snapshotWeekFor(new Date("2026-07-29T00:00:00Z"))).toBe(
      snapshotWeekFor(new Date("2026-07-29T23:59:59Z"))
    );
  });
});

describe("runScrape", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSql.mockResolvedValue([]);
  });

  it("upserts one row per chart entry for the current snapshot week", async () => {
    const sql = await makeSql();
    const result = await runScrape(sql, new Date("2026-07-29T10:00:00Z"), htmlFetch(CHART_ROW));

    expect(result).toEqual({ snapshotWeek: "2026-07-27", scraped: 1 });
    expect(mockSql).toHaveBeenCalledTimes(1);
    expect(statement(0)).toContain("INSERT INTO music_top100_tracks");
    expect(statement(0)).toContain("ON CONFLICT (snapshot_week, rank) DO UPDATE");
    // rank, title, artist, snapshot_week
    expect(mockSql.mock.calls[0].slice(1)).toEqual([1, "Choosin' Texas", "Ella Langley", "2026-07-27"]);
  });

  it("needs no Spotify credentials — IDs are resolved later by extract", async () => {
    const sql = await makeSql();
    await runScrape(sql, new Date("2026-07-27T10:00:00Z"), htmlFetch(CHART_ROW));
    expect(statement(0)).not.toContain("spotify_id = ${");
  });

  it("propagates a scrape failure so the caller can record a failed run", async () => {
    const sql = await makeSql();
    const failing = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(""),
    }) as unknown as typeof fetch;

    await expect(runScrape(sql, new Date("2026-07-27T10:00:00Z"), failing)).rejects.toThrow(
      "HTTP 503"
    );
    expect(mockSql).not.toHaveBeenCalled();
  });
});

describe("runExtract", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSql.mockResolvedValue([]);
  });

  it("searches Spotify, persists the ID, and stores extracted features", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 1, title: "One", artist: "A", spotify_id: null }]) // SELECT pending
      .mockResolvedValueOnce([]) // UPDATE spotify_id
      .mockResolvedValueOnce([]); // INSERT features

    const sql = await makeSql();
    const spotify = fakeSpotify();
    const result = await runExtract(sql, spotify, new Date("2026-07-27T10:00:00Z"));

    expect(result).toEqual({
      snapshotWeek: "2026-07-27",
      extracted: 1,
      unresolved: 0,
      failed: 0,
    });
    expect(spotify.searchTrack).toHaveBeenCalledWith("One A");
    expect(spotify.getTrackFeatures).toHaveBeenCalledWith("sp1");
    expect(statement(1)).toContain("UPDATE music_top100_tracks SET spotify_id");
    expect(statement(2)).toContain("INSERT INTO music_track_features");
  });

  it("skips the Spotify search when the track already has an ID", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 2, title: "Two", artist: "B", spotify_id: "known" }])
      .mockResolvedValueOnce([]);

    const sql = await makeSql();
    const spotify = fakeSpotify();
    const result = await runExtract(sql, spotify, new Date("2026-07-27T10:00:00Z"));

    expect(spotify.searchTrack).not.toHaveBeenCalled();
    expect(spotify.getTrackFeatures).toHaveBeenCalledWith("known");
    expect(result.extracted).toBe(1);
  });

  it("counts a track with no Spotify match as unresolved without failing the batch", async () => {
    mockSql.mockResolvedValueOnce([{ id: 3, title: "Obscure", artist: "C", spotify_id: null }]);

    const sql = await makeSql();
    const spotify = fakeSpotify({
      searchTrack: vi.fn().mockResolvedValue([]) as unknown as SpotifyClient["searchTrack"],
    });
    const result = await runExtract(sql, spotify, new Date("2026-07-27T10:00:00Z"));

    expect(result).toMatchObject({ extracted: 0, unresolved: 1, failed: 0 });
    expect(spotify.getTrackFeatures).not.toHaveBeenCalled();
  });

  it("isolates a per-track Spotify error so the rest of the batch still extracts", async () => {
    mockSql
      .mockResolvedValueOnce([
        { id: 1, title: "Good", artist: "A", spotify_id: "ok" },
        { id: 2, title: "Bad", artist: "B", spotify_id: "boom" },
      ])
      .mockResolvedValue([]);

    const sql = await makeSql();
    const spotify = fakeSpotify({
      getTrackFeatures: vi.fn().mockImplementation((id: string) => {
        if (id === "boom") return Promise.reject(new Error("HTTP 404"));
        return Promise.resolve({
          audioFeatures: { key: 0, mode: 1, tempo: 128 },
          sections: [{ key: 0, mode: 1 }],
        });
      }) as unknown as SpotifyClient["getTrackFeatures"],
    });

    const result = await runExtract(sql, spotify, new Date("2026-07-27T10:00:00Z"));
    expect(result).toMatchObject({ extracted: 1, failed: 1 });
  });

  it("only selects tracks that have no features row for the week", async () => {
    mockSql.mockResolvedValueOnce([]);
    const sql = await makeSql();
    await runExtract(sql, fakeSpotify(), new Date("2026-07-27T10:00:00Z"));

    expect(statement(0)).toContain("LEFT JOIN music_track_features");
    expect(statement(0)).toContain("f.id IS NULL");
  });
});

describe("runScore", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSql.mockResolvedValue([]);
  });

  it("upserts a score row per distinct feature value and prunes stale ones", async () => {
    mockSql
      .mockResolvedValueOnce([
        {
          key_mode: "C Major",
          bpm_range: "120-139",
          song_structure: "standard",
          chord_flavor: "single-key",
        },
        {
          key_mode: "C Major",
          bpm_range: "80-99",
          song_structure: "standard",
          chord_flavor: "single-key",
        },
      ])
      .mockResolvedValue([]);

    const sql = await makeSql();
    const result = await runScore(sql, new Date("2026-07-27T10:00:00Z"));

    // 1 key_mode + 2 bpm_range + 1 song_structure + 1 chord_flavor = 5 values.
    expect(result).toEqual({ snapshotWeek: "2026-07-27", tracksScored: 2, scoreCount: 5 });
    expect(statement(1)).toContain("INSERT INTO music_feature_scores");
    // 1 SELECT + 5 upserts + 1 prune
    expect(mockSql).toHaveBeenCalledTimes(7);
    expect(statement(6)).toContain("DELETE FROM music_feature_scores");
  });

  it("writes nothing and skips the prune when the week has no features yet", async () => {
    mockSql.mockResolvedValueOnce([]);
    const sql = await makeSql();
    const result = await runScore(sql, new Date("2026-07-27T10:00:00Z"));

    expect(result).toMatchObject({ tracksScored: 0, scoreCount: 0 });
    // Only the SELECT — no prune that would wipe a week we have no data for.
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

describe("recordPipelineRun", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockSql.mockResolvedValue([]);
  });

  it("upserts a success row with the record count", async () => {
    const sql = await makeSql();
    await recordPipelineRun(sql, "success", 42, null);

    expect(statement(0)).toContain("INSERT INTO pipeline_runs");
    expect(statement(0)).toContain("'success'");
    expect(mockSql.mock.calls[0].slice(1)).toEqual(["music", 42, 42]);
  });

  it("upserts a failure row carrying the error message", async () => {
    const sql = await makeSql();
    await recordPipelineRun(sql, "failed", null, "scrape: HTTP 503");

    expect(statement(0)).toContain("'failed'");
    expect(mockSql.mock.calls[0].slice(1)).toContain("scrape: HTTP 503");
  });

  it("swallows a status-write failure so it never masks the real outcome", async () => {
    mockSql.mockRejectedValue(new Error("pipeline_runs is gone"));
    const sql = await makeSql();
    await expect(recordPipelineRun(sql, "success", 1, null)).resolves.toBeUndefined();
  });
});
