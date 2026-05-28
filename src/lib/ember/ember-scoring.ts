// ember-scoring.ts — Risk score and tier assignment for fire clusters (issue #97).
// All scoring weights and tier thresholds are named constants. No magic numbers.

export type ClusterTier = "Monitor" | "Watch" | "Action";

// Scoring weights (must sum to 1.0)
export const FRP_WEIGHT = 0.4;
export const WEATHER_WEIGHT = 0.4;
export const TREND_WEIGHT = 0.2;

// FRP intensity normalization bounds (MW)
export const FRP_LOW_MW = 10;
export const FRP_HIGH_MW = 500;

// Tier score thresholds
export const WATCH_THRESHOLD = 40;
export const ACTION_THRESHOLD = 70;

// Weather danger: wind speed at which danger is maxed (mph)
export const MAX_DANGER_WIND_MPH = 50;

// Trend: match radius for finding a prior cluster (km)
export const TREND_MATCH_RADIUS_KM = 10;

// FRP component (0–100): linear ramp from FRP_LOW to FRP_HIGH.
export function scoreFrpIntensity(frp: number): number {
  if (frp <= FRP_LOW_MW) return 0;
  if (frp >= FRP_HIGH_MW) return 100;
  return ((frp - FRP_LOW_MW) / (FRP_HIGH_MW - FRP_LOW_MW)) * 100;
}

// Weather danger component (0–100).
// Red Flag overrides all other inputs. When a variable is null, uses 50 (neutral).
export function scoreWeatherDanger(
  windSpeedMph: number | null,
  humidityPct: number | null,
  redFlag: boolean
): number {
  if (redFlag) return 100;

  const rhScore = humidityPct != null ? Math.max(0, Math.min(100, 100 - humidityPct)) : 50;
  const windScore =
    windSpeedMph != null
      ? Math.max(0, Math.min(100, (windSpeedMph / MAX_DANGER_WIND_MPH) * 100))
      : 50;

  return (rhScore + windScore) / 2;
}

// Trend component (0–100): 50 = neutral (no change or no history).
// Uses fractional FRP change clamped so ±100% change maps to 100/0.
export function scoreTrend(currentFrp: number, priorFrp: number | null): number {
  if (priorFrp == null) return 50;
  const baseline = Math.max(priorFrp, 10);
  const change = (currentFrp - priorFrp) / baseline;
  return Math.min(100, Math.max(0, 50 + change * 50));
}

// Combined risk score (0–100) from the three weighted components.
export function computeRiskScore(
  frp: number,
  windSpeedMph: number | null,
  humidityPct: number | null,
  redFlag: boolean,
  priorFrp: number | null
): number {
  return (
    FRP_WEIGHT * scoreFrpIntensity(frp) +
    WEATHER_WEIGHT * scoreWeatherDanger(windSpeedMph, humidityPct, redFlag) +
    TREND_WEIGHT * scoreTrend(frp, priorFrp)
  );
}

export function assignTier(riskScore: number): ClusterTier {
  if (riskScore >= ACTION_THRESHOLD) return "Action";
  if (riskScore >= WATCH_THRESHOLD) return "Watch";
  return "Monitor";
}
