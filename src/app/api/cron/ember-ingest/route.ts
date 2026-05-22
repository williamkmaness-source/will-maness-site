// route.ts — EmberBrief skeleton cron handler (issue #93).
// Inserts one hardcoded fire cluster and upserts county conditions.
// Real NASA FIRMS ingest replaces the stub in issue #95.
// Runs every 10 minutes via Vercel Cron (see vercel.json).

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Shasta County centroid — used as the stub cluster location.
const STUB_LAT = 40.783;
const STUB_LNG = -122.493;
const STUB_FRP = 245.6; // MW — realistic mid-range value for a moderate fire
const STUB_DETECTION_COUNT = 3;

type IngestResult = {
  clusterId: number;
  conditionsUpserted: boolean;
};

export async function runIngest(sql: NeonQueryFunction<false, false>): Promise<IngestResult> {
  // Delete previous stub rows to prevent unbounded accumulation (runs every 10 min).
  // Real ingest (#95) will remove this cleanup and use proper deduplication.
  await sql`
    DELETE FROM ember_fire_clusters
    WHERE lat = ${STUB_LAT} AND lng = ${STUB_LNG}
  `;

  const clusterRows = await sql`
    INSERT INTO ember_fire_clusters (lat, lng, frp, detection_count, detected_at)
    VALUES (${STUB_LAT}, ${STUB_LNG}, ${STUB_FRP}, ${STUB_DETECTION_COUNT}, now())
    RETURNING id
  `;

  const clusterId = Number(clusterRows[0].id);

  await sql`
    INSERT INTO ember_county_conditions (county, wind_speed, wind_direction, humidity, temperature, red_flag, observed_at)
    VALUES ('Shasta County', 12, 'SW', 28, 78, false, now())
    ON CONFLICT (county) DO UPDATE SET
      wind_speed     = EXCLUDED.wind_speed,
      wind_direction = EXCLUDED.wind_direction,
      humidity       = EXCLUDED.humidity,
      temperature    = EXCLUDED.temperature,
      red_flag       = EXCLUDED.red_flag,
      observed_at    = EXCLUDED.observed_at
  `;

  return { clusterId, conditionsUpserted: true };
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

  const sql = neon(connectionString);

  try {
    const result = await runIngest(sql);
    console.log(`[ember-ingest] OK — cluster id=${result.clusterId}`);
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
