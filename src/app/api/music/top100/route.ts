// route.ts — current top 100 snapshot for the aggregate dashboard (issue #218).
// GET /api/music/top100?key_mode=&bpm_range=&song_structure=&chord_flavor= returns the
// latest scraped week with precomputed features and ratings. No Spotify calls at read
// time. Filters are optional, combinable, and applied in memory over 100 rows.

import type { NextRequest } from "next/server";
import {
  FEATURE_NAMES,
  getLatestFeatureScores,
  getLatestTop100,
  findScore,
  type FeatureName,
  type FeatureScoreSnapshot,
} from "@/lib/music-analyzer/music-queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<Response> {
  let snapshot: Awaited<ReturnType<typeof getLatestTop100>> = null;
  let scores: FeatureScoreSnapshot | null = null;

  try {
    [snapshot, scores] = await Promise.all([getLatestTop100(), getLatestFeatureScores()]);
  } catch (err) {
    console.error("[api/music/top100] read failed:", err);
    return Response.json({ error: "Top 100 is unavailable" }, { status: 503 });
  }

  // Before the first pipeline run there is nothing to show — an empty snapshot is a
  // legitimate state, not an error, so the dashboard renders its empty state.
  if (!snapshot) {
    return Response.json({ snapshotWeek: null, totalCount: 0, matchCount: 0, tracks: [] });
  }

  const filters = FEATURE_NAMES.map((name) => ({
    name,
    value: req.nextUrl.searchParams.get(name)?.trim() || null,
  })).filter((f): f is { name: FeatureName; value: string } => f.value !== null);

  const matching = snapshot.tracks.filter((track) =>
    filters.every((filter) => track.features[filter.name] === filter.value)
  );

  const tracks = matching.map((track) => ({
    rank: track.rank,
    title: track.title,
    artist: track.artist,
    features: FEATURE_NAMES.map((name) => {
      const value = track.features[name];
      const score = value ? findScore(scores, name, value) : null;
      return {
        name,
        value,
        rating: score?.rating ?? null,
        count: score?.count ?? null,
      };
    }),
  }));

  return Response.json({
    snapshotWeek: snapshot.snapshotWeek,
    totalCount: snapshot.tracks.length,
    matchCount: tracks.length,
    tracks,
  });
}
