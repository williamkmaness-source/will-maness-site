// Tests for the Synoptic weather client (issue #96).
// Covers Red Flag threshold logic and graceful handling of missing/error responses.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  evaluateRedFlag,
  degreesToCardinal,
  fetchWeatherForLocation,
} from "./weather-client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSynopticResponse(overrides?: {
  windSpeed?: number | null;
  windDir?: number | null;
  humidity?: number | null;
  temp?: number | null;
  responseCode?: number;
  stationCount?: number;
}) {
  const {
    windSpeed = 12.5,
    windDir = 225,
    humidity = 28,
    temp = 78,
    responseCode = 1,
    stationCount = 1,
  } = overrides ?? {};

  const observations: Record<string, unknown> = {};
  if (windSpeed != null)
    observations["wind_speed_value_1"] = { value: windSpeed, date_time: "2026-05-23T10:00:00Z" };
  if (windDir != null)
    observations["wind_direction_value_1"] = { value: windDir, date_time: "2026-05-23T10:00:00Z" };
  if (humidity != null)
    observations["relative_humidity_value_1"] = { value: humidity, date_time: "2026-05-23T10:00:00Z" };
  if (temp != null)
    observations["air_temp_value_1"] = { value: temp, date_time: "2026-05-23T10:00:00Z" };

  return {
    SUMMARY: { RESPONSE_CODE: responseCode, NUMBER_OF_OBJECTS: stationCount },
    STATION:
      stationCount > 0
        ? [{ STID: "KCOR", NAME: "Corning Airport", OBSERVATIONS: observations }]
        : [],
  };
}

function mockFetch(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    })
  );
}

// ── evaluateRedFlag ───────────────────────────────────────────────────────────

describe("evaluateRedFlag", () => {
  it("returns true when RH < 15% AND wind > 25 mph", () => {
    expect(evaluateRedFlag(26, 14)).toBe(true);
  });

  it("returns false when RH is exactly 15%", () => {
    expect(evaluateRedFlag(30, 15)).toBe(false);
  });

  it("returns false when wind is exactly 25 mph", () => {
    expect(evaluateRedFlag(25, 10)).toBe(false);
  });

  it("returns false when only wind threshold is met", () => {
    expect(evaluateRedFlag(30, 20)).toBe(false);
  });

  it("returns false when only RH threshold is met", () => {
    expect(evaluateRedFlag(10, 10)).toBe(false);
  });

  it("returns false when windSpeed is null", () => {
    expect(evaluateRedFlag(null, 10)).toBe(false);
  });

  it("returns false when humidity is null", () => {
    expect(evaluateRedFlag(30, null)).toBe(false);
  });

  it("returns false when both are null", () => {
    expect(evaluateRedFlag(null, null)).toBe(false);
  });
});

// ── degreesToCardinal ─────────────────────────────────────────────────────────

describe("degreesToCardinal", () => {
  it("converts 0° to N", () => expect(degreesToCardinal(0)).toBe("N"));
  it("converts 45° to NE", () => expect(degreesToCardinal(45)).toBe("NE"));
  it("converts 90° to E", () => expect(degreesToCardinal(90)).toBe("E"));
  it("converts 180° to S", () => expect(degreesToCardinal(180)).toBe("S"));
  it("converts 225° to SW", () => expect(degreesToCardinal(225)).toBe("SW"));
  it("converts 315° to NW", () => expect(degreesToCardinal(315)).toBe("NW"));
  it("converts 337° to NNW", () => expect(degreesToCardinal(337)).toBe("NNW"));
});

// ── fetchWeatherForLocation ───────────────────────────────────────────────────

describe("fetchWeatherForLocation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a parsed observation on a successful response", async () => {
    mockFetch(makeSynopticResponse({ windSpeed: 12.5, windDir: 225, humidity: 28, temp: 78 }));

    const result = await fetchWeatherForLocation(40.7, -122.5, "dummy-token");

    expect(result).not.toBeNull();
    expect(result!.stationId).toBe("KCOR");
    expect(result!.windSpeedMph).toBe(12.5);
    expect(result!.windDirectionDeg).toBe(225);
    expect(result!.humidityPct).toBe(28);
    expect(result!.temperatureF).toBe(78);
  });

  it("returns null when no stations are found within the radius", async () => {
    mockFetch(makeSynopticResponse({ stationCount: 0 }));

    const result = await fetchWeatherForLocation(40.7, -122.5, "dummy-token");
    expect(result).toBeNull();
  });

  it("returns null when RESPONSE_CODE is not 1", async () => {
    mockFetch({ SUMMARY: { RESPONSE_CODE: 2 }, STATION: [] });

    const result = await fetchWeatherForLocation(40.7, -122.5, "dummy-token");
    expect(result).toBeNull();
  });

  it("returns observation with null fields when sensor readings are missing", async () => {
    mockFetch(
      makeSynopticResponse({ windSpeed: null, windDir: null, humidity: null, temp: 65 })
    );

    const result = await fetchWeatherForLocation(40.7, -122.5, "dummy-token");
    expect(result).not.toBeNull();
    expect(result!.windSpeedMph).toBeNull();
    expect(result!.temperatureF).toBe(65);
  });

  it("throws when Synoptic API returns a non-OK HTTP status", async () => {
    mockFetch(null, false, 503);

    await expect(fetchWeatherForLocation(40.7, -122.5, "dummy-token")).rejects.toThrow(
      "Synoptic API returned HTTP 503"
    );
  });

  it("throws on fetch abort (timeout simulation)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("AbortError"), { name: "AbortError" }))
    );

    await expect(fetchWeatherForLocation(40.7, -122.5, "dummy-token")).rejects.toThrow();
  });
});
