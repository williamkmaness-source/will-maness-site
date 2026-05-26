// route.ts — EmberBrief cron handler: FIRMS ingest + Synoptic weather layer (issues #95, #96).
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
} from "@/lib/ember/weather-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IngestResult = {
  clusterCount: number;
  detectionCount: number;
  weatherUpdated: number;
  firmsError?: string;
};

export async function runIngest(
  sql: NeonQueryFunction<false, false>,
  firmsApiKey: string,
  synopticToken: string
): Promise<IngestResult> {
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

  // Clear all clusters and replace with the current ingest.
  // History for trend analysis (issue #97) will add per-run tracking.
  await sql`DELETE FROM ember_fire_clusters`;

  // Insert clusters, collecting IDs for the weather update pass.
  const insertedClusters: { id: number; lat: number; lng: number }[] = [];
  for (const c of clusters) {
    const rows = await sql`
      INSERT INTO ember_fire_clusters (lat, lng, frp, detection_count, detected_at)
      VALUES (${c.lat}, ${c.lng}, ${c.frp}, ${c.detectionCount}, ${c.detectedAt.toISOString()})
      RETURNING id
    `;
    insertedClusters.push({ id: Number(rows[0].id), lat: c.lat, lng: c.lng });
  }

  // ── Weather layer ───────────────────────────────────────────────────────────
  // Fetch weather in parallel for each cluster. Errors per cluster are caught
  // and logged without aborting the rest of the ingest.
  let weatherUpdated = 0;

  await Promise.all(
    insertedClusters.map(async ({ id, lat, lng }) => {
      try {
        const weather = await fetchWeatherForLocation(lat, lng, synopticToken);
        if (weather) {
          await sql`
            UPDATE ember_fire_clusters
            SET weather = ${JSON.stringify(weather)}::jsonb
            WHERE id = ${id}
          `;
          weatherUpdated++;
        }
      } catch (err) {
        console.error(`[ember-ingest] weather fetch failed for cluster id=${id}:`, err);
      }
    })
  );

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
      `[ember-ingest] OK — ${result.clusterCount} clusters, ${result.weatherUpdated} with weather`
    );
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ember-ingest] error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Ingest failed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
