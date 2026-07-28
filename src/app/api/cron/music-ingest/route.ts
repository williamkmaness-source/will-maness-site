// route.ts — Music analyzer cron handler: Billboard scrape + Spotify feature extract + scoring (issue #215).
// Runs daily at 10:00 UTC via Vercel Cron (see vercel.json) but only does work on Mondays: Billboard
// publishes weekly, and the Hobby plan bills per cron entry rather than per schedule granularity.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { NextRequest } from "next/server";
import { SpotifyClient } from "@/lib/music-analyzer/spotify-client";
import {
  runScrape,
  runExtract,
  runScore,
  recordPipelineRun,
} from "@/lib/music-analyzer/music-pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MONDAY = 1;

export type IngestResult = {
  snapshotWeek: string;
  scraped: number;
  extracted: number;
  unresolved: number;
  failed: number;
  tracksScored: number;
  scoreCount: number;
};

/** Billboard refreshes the Hot 100 weekly, so only Monday runs do work. */
export function isChartRefreshDay(date: Date): boolean {
  return date.getUTCDay() === MONDAY;
}

export async function runMusicIngest(
  sql: NeonQueryFunction<false, false>,
  spotify: SpotifyClient,
  now: Date = new Date()
): Promise<IngestResult> {
  const scrape = await runScrape(sql, now);
  const extract = await runExtract(sql, spotify, now);
  const score = await runScore(sql, now);

  return {
    snapshotWeek: scrape.snapshotWeek,
    scraped: scrape.scraped,
    extracted: extract.extracted,
    unresolved: extract.unresolved,
    failed: extract.failed,
    tracksScored: score.tracksScored,
    scoreCount: score.scoreCount,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const now = new Date();
  if (!isChartRefreshDay(now)) {
    return json({ status: "skipped", reason: "not Monday" });
  }

  const connectionString =
    process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    return new Response("No Postgres connection string configured", { status: 500 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not configured", {
      status: 500,
    });
  }

  const sql = neon(connectionString);

  try {
    const result = await runMusicIngest(sql, new SpotifyClient(clientId, clientSecret), now);
    console.log(
      `[music-ingest] OK — week ${result.snapshotWeek}: ${result.scraped} scraped, ${result.extracted} extracted, ${result.scoreCount} scores`
    );
    await recordPipelineRun(sql, "success", result.extracted, null);
    return json({ ok: true, status: "ran", ...result });
  } catch (err) {
    console.error("[music-ingest] error:", err);
    const message = err instanceof Error ? err.message : "Music ingest failed";
    await recordPipelineRun(sql, "failed", null, message);
    // 200 so Vercel Cron does not retry-storm a pipeline that will keep failing until fixed.
    return json({ ok: false, error: "Music ingest failed" });
  }
}
