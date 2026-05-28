// Tests for the NASA FIRMS NRT client (issue #95).
// Covers confidence filter and bounding box filter against mocked HTTP responses.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchFirmsDetections,
  meetsConfidenceThreshold,
  isWithinBbox,
  LAKE_TAHOE_BASIN_BBOX,
  type FirmsDetection,
} from "./firms-client";

// ── Helpers ───────────────────────────────────────────────────────────────────

const HEADER =
  "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight";

function csvRow(
  lat: number,
  lng: number,
  frp: number,
  confidence: string,
  date = "2026-05-23",
  time = "1000"
): string {
  return `${lat},${lng},320.5,0.4,0.4,${date},${time},N,VIIRS,${confidence},2.0NRT,310.2,${frp},D`;
}

function makeDet(overrides: Partial<FirmsDetection> = {}): FirmsDetection {
  return {
    lat: 39.0,
    lng: -120.0,
    frp: 100,
    confidence: "h",
    detectedAt: new Date(),
    ...overrides,
  };
}

function mockFetch(csv: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(csv) })
  );
}

// ── meetsConfidenceThreshold ──────────────────────────────────────────────────

describe("meetsConfidenceThreshold", () => {
  it("accepts nominal confidence", () => {
    expect(meetsConfidenceThreshold(makeDet({ confidence: "n" }))).toBe(true);
  });

  it("accepts high confidence", () => {
    expect(meetsConfidenceThreshold(makeDet({ confidence: "h" }))).toBe(true);
  });

  it("rejects low confidence", () => {
    expect(meetsConfidenceThreshold(makeDet({ confidence: "l" }))).toBe(false);
  });
});

// ── isWithinBbox ─────────────────────────────────────────────────────────────

describe("isWithinBbox", () => {
  it("accepts coordinates inside Lake Tahoe Basin bbox", () => {
    expect(isWithinBbox(makeDet({ lat: 39.0, lng: -120.0 }), LAKE_TAHOE_BASIN_BBOX)).toBe(true);
  });

  it("rejects coordinates south of the bbox", () => {
    expect(isWithinBbox(makeDet({ lat: 38.0, lng: -120.0 }), LAKE_TAHOE_BASIN_BBOX)).toBe(false);
  });

  it("rejects coordinates east of the bbox", () => {
    expect(isWithinBbox(makeDet({ lat: 39.0, lng: -118.5 }), LAKE_TAHOE_BASIN_BBOX)).toBe(false);
  });

  it("rejects coordinates north of the bbox", () => {
    expect(isWithinBbox(makeDet({ lat: 40.0, lng: -120.0 }), LAKE_TAHOE_BASIN_BBOX)).toBe(false);
  });

  it("rejects coordinates west of the bbox", () => {
    expect(isWithinBbox(makeDet({ lat: 39.0, lng: -121.0 }), LAKE_TAHOE_BASIN_BBOX)).toBe(false);
  });
});

// ── fetchFirmsDetections ──────────────────────────────────────────────────────

describe("fetchFirmsDetections", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("filters out low-confidence detections", async () => {
    const csv = [
      HEADER,
      csvRow(39.0, -120.0, 100, "l"),
      csvRow(39.1, -120.1, 150, "n"),
    ].join("\n");
    mockFetch(csv);

    const result = await fetchFirmsDetections("dummy");
    expect(result).toHaveLength(1);
    expect(result[0].frp).toBe(150);
    expect(result[0].confidence).toBe("n");
  });

  it("keeps both nominal and high confidence detections", async () => {
    const csv = [
      HEADER,
      csvRow(39.0, -120.0, 100, "h"),
      csvRow(39.1, -120.1, 80, "n"),
      csvRow(39.2, -120.2, 50, "l"),
    ].join("\n");
    mockFetch(csv);

    const result = await fetchFirmsDetections("dummy");
    expect(result).toHaveLength(2);
  });

  it("filters out detections outside the bounding box", async () => {
    const csv = [
      HEADER,
      csvRow(39.0, -120.0, 100, "h"),  // inside Lake Tahoe Basin
      csvRow(37.0, -120.0, 200, "h"),  // outside (too far south)
    ].join("\n");
    mockFetch(csv);

    const result = await fetchFirmsDetections("dummy");
    expect(result).toHaveLength(1);
    expect(result[0].lat).toBeCloseTo(39.0);
  });

  it("returns empty array when FIRMS returns only a header", async () => {
    mockFetch(HEADER);

    const result = await fetchFirmsDetections("dummy");
    expect(result).toHaveLength(0);
  });

  it("returns empty array when FIRMS returns empty string", async () => {
    mockFetch("");

    const result = await fetchFirmsDetections("dummy");
    expect(result).toHaveLength(0);
  });

  it("throws when FIRMS API returns a non-OK HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429 })
    );

    await expect(fetchFirmsDetections("dummy")).rejects.toThrow(
      "FIRMS API returned HTTP 429"
    );
  });

  it("parses acq_date and acq_time into detectedAt", async () => {
    const csv = [HEADER, csvRow(39.0, -120.0, 100, "h", "2026-05-23", "1430")].join("\n");
    mockFetch(csv);

    const result = await fetchFirmsDetections("dummy");
    expect(result[0].detectedAt.toISOString()).toBe("2026-05-23T14:30:00.000Z");
  });
});
