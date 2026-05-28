// route.ts — EmberBrief cron handler: FIRMS ingest + weather + risk scoring (issues #95, #96, #97).
// Runs daily at 09:00 UTC via Vercel Cron (see vercel.json).

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { NextRequest } from "next/server";
import { fetchFirmsDetections, type FirmsDetection } from "@/lib/ember/firms-client";
import { clusterDetections } from "@/lib/ember/cluster-engine";
import {
  fetchWeatherForLocation,
  evaluateRedFlag,
  degreesToCardinal,
  LAKE_TAHOE_BASIN_CENTROID,
  type WeatherObservation,
} from "@/lib/ember/weather-client";
import {
  computeRiskScore,
  assignTier,
  TREND_MATCH_RADIUS_KM,
} from "@/lib/ember/ember-scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IngestResult = {
  clusterCount: number;
  detectionCount: number;
  weatherUpdated: number;
  scored: number;
  firmsError?: string;
};

type PriorCluster = { lat: number; lng: number; frp: number };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestPriorFrp(
  priors: PriorCluster[],
  lat: number,
  lng: number
): number | null {
  let nearest: { frp: number; dist: number } | null = null;
  for (const p of priors) {
    const dist = haversineKm(lat, lng, Number(p.lat), Number(p.lng));
    if (dist <= TREND_MATCH_RADIUS_KM && (nearest === null || dist < nearest.dist)) {
      nearest = { frp: Number(p.frp), dist };
    }
  }
  return nearest?.frp ?? null;
}

export async function runIngest(
  sql: NeonQueryFunction<false, false>,
  firmsApiKey: string,
  synopticToken: string
): Promise<IngestResult> {
  // ── Snapshot prior clusters for trend analysis ──────────────────────────────
  // Query before DELETE so scoring can compare new FRP to the previous run.
  const priorRows = await sql`SELECT lat, lng, frp FROM ember_fire_clusters`;
  const priorClusters: PriorCluster[] = priorRows.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lng),
    frp: Number(r.frp),
  }));

  // ── FIRMS ingest ────────────────────────────────────────────────────────────
  let detections: FirmsDetection[];
  let firmsError: string | undefined;

  try {
    detections = await fetchFirmsDetections(firmsApiKey);
  } catch (err) {
    firmsError = err instanceof Error ? err.message : String(err);
    console.error("[ember-ingest] FIRMS fetch failed:", firmsError);
    detections = [];
  }

  const clusters = clusterDetections(detections);

  await sql`DELETE FROM ember_fire_clusters`;

  // Insert clusters, collecting IDs + in-memory data for scoring pass.
  const insertedClusters: {
    id: number;
    lat: number;
    lng: number;
    frp: number;
    weather: WeatherObservation | null;
  }[] = [];

  for (const c of clusters) {
    const rows = await sql`
      INSERT INTO ember_fire_clusters (lat, lng, frp, detection_count, detected_at)
      VALUES (${c.lat}, ${c.lng}, ${c.frp}, ${c.detectionCount}, ${c.detectedAt.toISOString()})
      RETURNING id
    `;
    insertedClusters.push({ id: Number(rows[0].id), lat: c.lat, lng: c.lng, frp: c.frp, weather: null });
  }

  // ── Weather layer ───────────────────────────────────────────────────────────
  let weatherUpdated = 0;

  await Promise.all(
    insertedClusters.map(async (cluster) => {
      try {
        const weather = await fetchWeatherForLocation(cluster.lat, cluster.lng, synopticToken);
        if (weather) {
          await sql`
            UPDATE ember_fire_clusters
            SET weather = ${JSON.stringify(weather)}::jsonb
            WHERE id = ${cluster.id}
          `;
          cluster.weather = weather;
          weatherUpdated++;
        }
      } catch (err) {
        console.error(`[ember-ingest] weather fetch failed for cluster id=${cluster.id}:`, err);
      }
    })
  );

  // ── Risk scoring ────────────────────────────────────────────────────────────
  let scored = 0;

  for (const cluster of insertedClusters) {
    const windSpeedMph = cluster.weather?.windSpeedMph ?? null;
    const humidityPct = cluster.weather?.humidityPct ?? null;
    const redFlag = evaluateRedFlag(windSpeedMph, humidityPct);
    const priorFrp = findNearestPriorFrp(priorClusters, cluster.lat, cluster.lng);
    const riskScore = computeRiskScore(cluster.frp, windSpeedMph, humidityPct, redFlag, priorFrp);
    const tier = assignTier(riskScore);

    await sql`
      UPDATE ember_fire_clusters
      SET risk_score = ${riskScore}, tier = ${tier}
      WHERE id = ${cluster.id}
    `;
    scored++;
  }

  // ── County conditions ───────────────────────────────────────────────────────
  try {
    const countyWeather = await fetchWeatherForLocation(
      LAKE_TAHOE_BASIN_CENTROID.lat,
      LAKE_TAHOE_BASIN_CENTROID.lng,
      synopticToken
    );

    if (countyWeather) {
      const redFlag = evaluateRedFlag(countyWeather.windSpeedMph, countyWeather.humidityPct);
      const windDirCardinal =
        countyWeather.windDirectionDeg != null
          ? degreesToCardinal(countyWeather.windDirectionDeg)
          : null;

      await sql`
        INSERT INTO ember_county_conditions
          (county, wind_speed, wind_direction, wind_gust_mph, humidity, temperature,
           precip_24h_in, red_flag, observed_at)
        VALUES
          ('Lake Tahoe Basin', ${countyWeather.windSpeedMph}, ${windDirCardinal},
           ${countyWeather.windGustMph}, ${countyWeather.humidityPct}, ${countyWeather.temperatureF},
           ${countyWeather.precip24hIn}, ${redFlag}, ${countyWeather.observedAt})
        ON CONFLICT (county) DO UPDATE SET
          wind_speed     = EXCLUDED.wind_speed,
          wind_direction = EXCLUDED.wind_direction,
          wind_gust_mph  = EXCLUDED.wind_gust_mph,
          humidity       = EXCLUDED.humidity,
          temperature    = EXCLUDED.temperature,
          precip_24h_in  = EXCLUDED.precip_24h_in,
          red_flag       = EXCLUDED.red_flag,
          observed_at    = EXCLUDED.observed_at
      `;
    }
  } catch (err) {
    console.error("[ember-ingest] county conditions update failed:", err);
  }

  return {
    clusterCount: clusters.length,
    detectionCount: detections.length,
    weatherUpdated,
    scored,
    ...(firmsError !== undefined && { firmsError }),
  };
}

export async function GET(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const connectionString =
    process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    return new Response("No Postgres connection string configured", { status: 500 });
  }

  const firmsApiKey = process.env.FIRMS_API_KEY;
  if (!firmsApiKey) {
    return new Response("FIRMS_API_KEY not configured", { status: 500 });
  }

  const synopticToken = process.env.SYNOPTIC_API_KEY;
  if (!synopticToken) {
    return new Response("SYNOPTIC_API_KEY not configured", { status: 500 });
  }

  const sql = neon(connectionString);

  try {
    const result = await runIngest(sql, firmsApiKey, synopticToken);
    console.log(
      `[ember-ingest] OK — ${result.clusterCount} clusters, ${result.weatherUpdated} with weather, ${result.scored} scored`
    );
    try {
      await sql`
        INSERT INTO pipeline_runs (pipeline, status, last_success_at, last_attempt_at, record_count, error)
        VALUES ('ember', 'success', NOW(), NOW(), ${result.clusterCount}, NULL)
        ON CONFLICT (pipeline) DO UPDATE SET
          status = 'success',
          last_success_at = NOW(),
          last_attempt_at = NOW(),
          record_count = ${result.clusterCount},
          error = NULL
      `;
    } catch (e) { console.warn("[ember-ingest] pipeline_runs upsert failed:", e); }
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ember-ingest] error:", err);
    const message = err instanceof Error ? err.message : "Ingest failed";
    try {
      await sql`
        INSERT INTO pipeline_runs (pipeline, status, last_attempt_at, error)
        VALUES ('ember', 'failed', NOW(), ${message})
        ON CONFLICT (pipeline) DO UPDATE SET
          status = 'failed',
          last_attempt_at = NOW(),
          error = ${message}
      `;
    } catch (e) { console.warn("[ember-ingest] pipeline_runs upsert failed:", e); }
    return new Response(JSON.stringify({ ok: false, error: "Ingest failed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
