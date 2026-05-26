// weather-client.ts — NOAA Synoptic weather client for EmberBrief (issue #96).
// Stateless pure function — takes lat/lng and API token, returns current observation.

export interface WeatherObservation {
  stationId: string;
  windSpeedMph: number | null;
  windDirectionDeg: number | null;
  windGustMph: number | null;
  humidityPct: number | null;
  temperatureF: number | null;
  precip24hIn: number | null;
  observedAt: string;
}

// Lake Tahoe Basin centroid — used for county-level weather lookup.
export const LAKE_TAHOE_BASIN_CENTROID = { lat: 39.05, lng: -120.05 };

const SYNOPTIC_BASE_URL = "https://api.synopticdata.com/v2/stations/latest";
const FETCH_TIMEOUT_MS = 20_000;

const CARDINAL_DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"] as const;

export function degreesToCardinal(deg: number): string {
  return CARDINAL_DIRS[Math.round(deg / 22.5) % 16];
}

// Red Flag: RH < 15% AND wind > 25 mph (CAL FIRE / NOAA standard thresholds).
export function evaluateRedFlag(
  windSpeedMph: number | null,
  humidityPct: number | null
): boolean {
  if (windSpeedMph == null || humidityPct == null) return false;
  return humidityPct < 15 && windSpeedMph > 25;
}

function extractValue(
  obs: Record<string, Record<string, unknown>>,
  key: string
): number | null {
  const entry = obs[key];
  if (!entry || entry.value == null) return null;
  const val = Number(entry.value);
  return isNaN(val) ? null : val;
}

function extractDateTime(
  obs: Record<string, Record<string, unknown>>,
  key: string
): string | null {
  const entry = obs[key];
  if (!entry || !entry.date_time) return null;
  return String(entry.date_time);
}

function parseStationResponse(json: unknown): WeatherObservation | null {
  if (typeof json !== "object" || json === null) return null;
  const data = json as Record<string, unknown>;

  const summary = data.SUMMARY as Record<string, unknown> | undefined;
  if (!summary || summary.RESPONSE_CODE !== 1) return null;

  const stations = data.STATION as unknown[] | undefined;
  if (!stations || stations.length === 0) return null;

  const station = stations[0] as Record<string, unknown>;
  const stid = String(station.STID ?? "unknown");
  const obs = (station.OBSERVATIONS as Record<string, Record<string, unknown>>) ?? {};

  const windSpeedMph = extractValue(obs, "wind_speed_value_1");
  const windDirectionDeg = extractValue(obs, "wind_direction_value_1");
  const windGustMph = extractValue(obs, "wind_gust_value_1");
  const humidityPct = extractValue(obs, "relative_humidity_value_1");
  const temperatureF = extractValue(obs, "air_temp_value_1");
  const precip24hIn = extractValue(obs, "precip_accum_value_1");

  const observedAt =
    extractDateTime(obs, "air_temp_value_1") ??
    extractDateTime(obs, "wind_speed_value_1") ??
    new Date().toISOString();

  return { stationId: stid, windSpeedMph, windDirectionDeg, windGustMph, humidityPct, temperatureF, precip24hIn, observedAt };
}

export async function fetchWeatherForLocation(
  lat: number,
  lng: number,
  apiToken: string,
  radiusMiles = 30
): Promise<WeatherObservation | null> {
  const params = new URLSearchParams({
    token: apiToken,
    radius: `${lat},${lng},${radiusMiles}`,
    limit: "1",
    vars: "wind_speed,wind_direction,wind_gust,relative_humidity,air_temp,precip_accum",
    units: "english",
    obtimezone: "UTC",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${SYNOPTIC_BASE_URL}?${params}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Synoptic API returned HTTP ${res.status}`);

    const json = await res.json();
    return parseStationResponse(json);
  } finally {
    clearTimeout(timeout);
  }
}
