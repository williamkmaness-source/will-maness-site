// Tests for the NASA FIRMS NRT client (issue #95).
// Covers confidence filter and bounding box filter against mocked HTTP responses.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchFirmsDetections,
  meetsConfidenceThreshold,
  isWithinBbox,
  SHASTA_COUNTY_BBOX,
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
    lat: 40.7,
    lng: -122.5,
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
  it("accepts coordinates inside Shasta County bbox", () => {
    expect(isWithinBbox(makeDet({ lat: 40.7, lng: -122.5 }), SHASTA_COUNTY_BBOX)).toBe(true);
  });

  it("rejects coordinates south of the bbox", () => {
    expect(isWithinBbox(makeDet({ lat: 37.0, lng: -122.5 }), SHASTA_COUNTY_BBOX)).toBe(false);
  });

  it("rejects coordinates east of the bbox", () => {
    expect(isWithinBbox(makeDet({ lat: 40.7, lng: -120.0 }), SHASTA_COUNTY_BBOX)).toBe(false);
  });

  it("rejects coordinates north of the bbox", () => {
    expect(isWithinBbox(makeDet({ lat: 41.5, lng: -122.5 }), SHASTA_COUNTY_BBOX)).toBe(false);
  });

  it("rejects coordinates west of the bbox", () => {
    expect(isWithinBbox(makeDet({ lat: 40.7, lng: -124.0 }), SHASTA_COUNTY_BBOX)).toBe(false);
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
      csvRow(40.7, -122.5, 100, "l"),
      csvRow(40.6, -122.4, 150, "n"),
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
      csvRow(40.7, -122.5, 100, "h"),
      csvRow(40.6, -122.4, 80, "n"),
      csvRow(40.5, -122.3, 50, "l"),
    ].join("\n");
    mockFetch(csv);

    const result = await fetchFirmsDetections("dummy");
    expect(result).toHaveLength(2);
  });

  it("filters out detections outside the bounding box", async () => {
    const csv = [
      HEADER,
      csvRow(40.7, -122.5, 100, "h"),  // inside Shasta County
      csvRow(37.0, -120.0, 200, "h"),  // outside (LA area)
    ].join("\n");
    mockFetch(csv);

    const result = await fetchFirmsDetections("dummy");
    expect(result).toHaveLength(1);
    expect(result[0].lat).toBeCloseTo(40.7);
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
    const csv = [HEADER, csvRow(40.7, -122.5, 100, "h", "2026-05-23", "1430")].join("\n");
    mockFetch(csv);

    const result = await fetchFirmsDetections("dummy");
    expect(result[0].detectedAt.toISOString()).toBe("2026-05-23T14:30:00.000Z");
  });
});
