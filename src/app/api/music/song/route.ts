// route.ts — on-demand song lookup for the music analyzer (issue #216).
// GET /api/music/song?q= searches Spotify, extracts the four features, and rates each
// against the latest weekly top 100 snapshot. Scores degrade to null (never a 500) when
// the pipeline has not run yet; a missing Spotify credential returns a 503.

import type { NextRequest } from "next/server";
import { getLatestFeatureScores, type FeatureScoreSnapshot } from "@/lib/music-analyzer/music-queries";
import { buildSongBreakdown, getSpotifyClient } from "@/lib/music-analyzer/song-breakdown";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<Response> {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return Response.json({ error: "Missing search query" }, { status: 400 });

  const client = getSpotifyClient();
  if (!client) {
    return Response.json({ error: "Spotify is not configured" }, { status: 503 });
  }

  try {
    const results = await client.searchTrack(q);
    const track = results[0];
    if (!track) return Response.json({ breakdown: null });

    // A missing or empty scores table is expected before the first pipeline run —
    // the breakdown still renders, just without ratings.
    let snapshot: FeatureScoreSnapshot | null = null;
    try {
      snapshot = await getLatestFeatureScores();
    } catch (err) {
      console.error("[api/music/song] getLatestFeatureScores failed:", err);
    }

    const breakdown = await buildSongBreakdown(client, track, snapshot);
    return Response.json({ breakdown });
  } catch (err) {
    console.error("[api/music/song] lookup failed:", err);
    return Response.json({ error: "Song lookup failed" }, { status: 502 });
  }
}
