// route.ts — side-by-side compare lookup for the music analyzer (issue #217).
// GET /api/music/compare?a=&b= resolves each slot to a scored breakdown and returns both
// in one response. Either param may be omitted, which is what lets each compare column
// search independently without resetting the other — an absent slot comes back as null.

import type { NextRequest } from "next/server";
import { getLatestFeatureScores, type FeatureScoreSnapshot } from "@/lib/music-analyzer/music-queries";
import {
  buildSongBreakdown,
  getSpotifyClient,
  type SongBreakdownData,
} from "@/lib/music-analyzer/song-breakdown";
import type { SpotifyClient } from "@/lib/music-analyzer/spotify-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolve(
  client: SpotifyClient,
  query: string | null,
  snapshot: FeatureScoreSnapshot | null
): Promise<SongBreakdownData | null> {
  if (!query) return null;
  const [track] = await client.searchTrack(query);
  if (!track) return null;
  return buildSongBreakdown(client, track, snapshot);
}

export async function GET(req: NextRequest): Promise<Response> {
  const a = req.nextUrl.searchParams.get("a")?.trim() || null;
  const b = req.nextUrl.searchParams.get("b")?.trim() || null;
  if (!a && !b) {
    return Response.json({ error: "Provide at least one song to compare" }, { status: 400 });
  }

  const client = getSpotifyClient();
  if (!client) {
    return Response.json({ error: "Spotify is not configured" }, { status: 503 });
  }

  try {
    // Ratings are best-effort: before the first pipeline run there is no snapshot,
    // and the comparison is still useful on raw feature values alone.
    let snapshot: FeatureScoreSnapshot | null = null;
    try {
      snapshot = await getLatestFeatureScores();
    } catch (err) {
      console.error("[api/music/compare] getLatestFeatureScores failed:", err);
    }

    const [breakdownA, breakdownB] = await Promise.all([
      resolve(client, a, snapshot),
      resolve(client, b, snapshot),
    ]);

    return Response.json({ a: breakdownA, b: breakdownB });
  } catch (err) {
    console.error("[api/music/compare] compare failed:", err);
    return Response.json({ error: "Compare lookup failed" }, { status: 502 });
  }
}
