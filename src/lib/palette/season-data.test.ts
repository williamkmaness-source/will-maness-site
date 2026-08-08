import { describe, it, expect } from "vitest";
import { normalizeHex } from "./color-math";
import {
  SEASONS,
  SEASON_LIST,
  SEASON_COLOR_COUNT,
  DEFAULT_SEASON_ID,
  getSeason,
  type Season,
} from "./season-data";

// Season data is hand-entered from a reference palette, so a typo'd hex or a truncated set
// is the most likely way this app breaks. These tests make bad data fail at test time
// rather than at render time, and they run over SEASONS generically — a season added later
// is covered the moment its entry exists, with no test change.

const SIX_DIGIT_HEX = /^#[0-9A-Fa-f]{6}$/;

const entries = Object.entries(SEASONS) as [string, Season][];

describe("season data", () => {
  it("ships at least the two launch seasons", () => {
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(SEASONS)).toContain("light-summer");
    expect(Object.keys(SEASONS)).toContain("dull-winter");
  });

  it("keys SEASONS by each season's own id", () => {
    for (const [key, season] of entries) {
      expect(season.id).toBe(key);
    }
  });

  it("exposes every season through SEASON_LIST exactly once", () => {
    expect(SEASON_LIST).toHaveLength(entries.length);
    const ids = SEASON_LIST.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [key] of entries) {
      expect(ids).toContain(key);
    }
  });

  it("defaults to a season that exists", () => {
    expect(getSeason(DEFAULT_SEASON_ID)).toBeDefined();
  });

  it("returns undefined for an unknown season id", () => {
    expect(getSeason("bright-spring")).toBeUndefined();
  });

  describe.each(entries)("%s", (_key, season) => {
    it("has a name and a blurb", () => {
      expect(season.name.trim().length).toBeGreaterThan(0);
      expect(season.blurb.trim().length).toBeGreaterThan(0);
    });

    it(`has between ${SEASON_COLOR_COUNT.min} and ${SEASON_COLOR_COUNT.max} colors`, () => {
      expect(season.colors.length).toBeGreaterThanOrEqual(SEASON_COLOR_COUNT.min);
      expect(season.colors.length).toBeLessThanOrEqual(SEASON_COLOR_COUNT.max);
    });

    it("has only valid, parseable 6-digit hex colors", () => {
      for (const hex of season.colors) {
        expect(hex, `${season.id}: "${hex}" is not a 6-digit hex`).toMatch(SIX_DIGIT_HEX);
        expect(normalizeHex(hex), `${season.id}: "${hex}" did not parse`).not.toBeNull();
      }
    });

    it("has no duplicate colors", () => {
      const seen = season.colors.map((hex) => hex.toLowerCase());
      expect(new Set(seen).size).toBe(seen.length);
    });
  });
});
