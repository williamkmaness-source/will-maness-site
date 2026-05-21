// route.ts — Chess pipeline health cron handler (issue #46).
// Runs every 5 minutes via Vercel Cron (see vercel.json).
// Pings the Lichess Broadcasts API, then upserts a status row in pipeline_runs.
// On failure the row is always written — the handler never throws silently.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LICHESS_BROADCASTS_URL = "https://lichess.org/api/broadcast?nb=10";
const RATE_LIMIT_THRESHOLD = 10;

type UpsertPayload = {
  status: "success" | "failed";
  lastSuccessAt: Date | null;
  recordCount: number | null;
  error: string | null;
};

export async function upsertPipelineRun(
  sql: NeonQueryFunction<false, false>,
  payload: UpsertPayload,
): Promise<void> {
  await sql`
    INSERT INTO pipeline_runs (pipeline, status, last_success_at, last_attempt_at, record_count, error)
    VALUES (
      'chess',
      ${payload.status},
      ${payload.lastSuccessAt?.toISOString() ?? null},
      now(),
      ${payload.recordCount},
      ${payload.error}
    )
    ON CONFLICT (pipeline) DO UPDATE SET
      status          = EXCLUDED.status,
      last_success_at = COALESCE(EXCLUDED.last_success_at, pipeline_runs.last_success_at),
      last_attempt_at = EXCLUDED.last_attempt_at,
      record_count    = EXCLUDED.record_count,
      error           = EXCLUDED.error
  `;
}

export async function GET(req: NextRequest): Promise<Response> {
  // Verify Vercel's cron secret so only Vercel's scheduler can trigger this.
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
    return new Response("No Postgres connection string configured", {
      status: 500,
    });
  }

  const sql = neon(connectionString);

  let lichessRes: Response;
  try {
    lichessRes = await fetch(LICHESS_BROADCASTS_URL);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chess-health] Lichess fetch error:", message);
    await upsertPipelineRun(sql, {
      status: "failed",
      lastSuccessAt: null,
      recordCount: null,
      error: `Network error: ${message}`,
    });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Respect rate-limit headers — back off when quota is nearly exhausted.
  const remaining = Number(
    lichessRes.headers.get("X-RateLimit-Remaining") ?? Infinity,
  );
  if (remaining < RATE_LIMIT_THRESHOLD) {
    console.warn(
      `[chess-health] Rate limit low (${remaining} remaining) — skipping write`,
    );
    return new Response(
      JSON.stringify({ ok: true, skipped: true, rateLimitRemaining: remaining }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!lichessRes.ok) {
    const errorMsg = `Lichess API returned ${lichessRes.status}`;
    console.error("[chess-health]", errorMsg);
    await upsertPipelineRun(sql, {
      status: "failed",
      lastSuccessAt: null,
      recordCount: null,
      error: errorMsg,
    });
    return new Response(JSON.stringify({ ok: false, error: errorMsg }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Lichess returns NDJSON (one JSON object per line).
  let broadcasts: Array<{ tour?: { name?: string } }> = [];
  try {
    const text = await lichessRes.text();
    broadcasts = text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { tour?: { name?: string } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chess-health] NDJSON parse error:", message);
    await upsertPipelineRun(sql, {
      status: "failed",
      lastSuccessAt: null,
      recordCount: null,
      error: `Parse error: ${message}`,
    });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const activeTournament = broadcasts[0]?.tour?.name ?? null;
  console.log(
    `[chess-health] OK — ${broadcasts.length} broadcast(s), active: ${activeTournament ?? "none"}`,
  );

  await upsertPipelineRun(sql, {
    status: "success",
    lastSuccessAt: new Date(),
    recordCount: broadcasts.length,
    error: null,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      broadcastCount: broadcasts.length,
      activeTournament,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
