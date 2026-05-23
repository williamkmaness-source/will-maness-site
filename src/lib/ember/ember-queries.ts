import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

const MAX_CLUSTERS = 50;

export type ClusterTier = "Monitor" | "Watch" | "Action";

const VALID_TIERS = new Set<string>(["Monitor", "Watch", "Action"]);

export interface FireCluster {
  id: number;
  lat: number;
  lng: number;
  frp: number;
  detectionCount: number;
  detectedAt: string;
  riskScore: number | null;
  tier: ClusterTier | null;
  weather: Record<string, unknown> | null;
  briefing: string | null;
  briefingGeneratedAt: string | null;
}

export interface CountyConditions {
  county: string;
  windSpeed: number | null;
  windDirection: string | null;
  humidity: number | null;
  temperature: number | null;
  redFlag: boolean;
  forecast: Record<string, unknown> | null;
  observedAt: string;
}

export interface EmberData {
  clusters: FireCluster[];
  countyConditions: CountyConditions | null;
}

export async function getEmberData(sql: NeonQueryFunction<false, false>): Promise<EmberData> {
  const [clusterRows, conditionRows] = await Promise.all([
    sql`
      SELECT
        id, lat, lng, frp, detection_count, detected_at,
        risk_score, tier, weather, briefing, briefing_generated_at
      FROM ember_fire_clusters
      ORDER BY detected_at DESC
      LIMIT ${MAX_CLUSTERS}
    `,
    sql`
      SELECT county, wind_speed, wind_direction, humidity, temperature,
             red_flag, forecast, observed_at
      FROM ember_county_conditions
      WHERE county = 'Shasta County'
      LIMIT 1
    `,
  ]);

  const clusters: FireCluster[] = clusterRows.map((r) => ({
    id: Number(r.id),
    lat: Number(r.lat),
    lng: Number(r.lng),
    frp: Number(r.frp),
    detectionCount: Number(r.detection_count),
    detectedAt: String(r.detected_at),
    riskScore: r.risk_score != null ? Number(r.risk_score) : null,
    tier: typeof r.tier === "string" && VALID_TIERS.has(r.tier) ? (r.tier as ClusterTier) : null,
    weather: r.weather as Record<string, unknown> | null,
    briefing: (r.briefing as string) ?? null,
    briefingGeneratedAt: r.briefing_generated_at != null ? String(r.briefing_generated_at) : null,
  }));

  const cond = conditionRows[0];
  const countyConditions: CountyConditions | null = cond
    ? {
        county: String(cond.county),
        windSpeed: cond.wind_speed != null ? Number(cond.wind_speed) : null,
        windDirection: (cond.wind_direction as string) ?? null,
        humidity: cond.humidity != null ? Number(cond.humidity) : null,
        temperature: cond.temperature != null ? Number(cond.temperature) : null,
        redFlag: Boolean(cond.red_flag),
        forecast: cond.forecast as Record<string, unknown> | null,
        observedAt: String(cond.observed_at),
      }
    : null;

  return { clusters, countyConditions };
}

export function getSqlClient(): NeonQueryFunction<false, false> {
  const connectionString = process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("No Postgres connection string configured");
  return neon(connectionString);
}
