// song-breakdown.ts — composes a scored feature breakdown for one track (issues #216, #217).
// Shared by /api/music/song and /api/music/compare so both routes rate a song identically:
// Spotify audio data → four normalized features → hot-to-indie rating from the latest snapshot.

import { SpotifyClient } from "./spotify-client";
import { extractFeatures } from "./feature-extractor";
import {
  FEATURE_NAMES,
  findScore,
  type FeatureName,
  type FeatureRating,
  type FeatureScoreSnapshot,
} from "./music-queries";

export interface ScoredFeature {
  name: FeatureName;
  value: string;
  /** Null when the pipeline has never run, or has never seen this value. */
  rating: FeatureRating | null;
  /** How many of the top 100 share this value; null when unscored. */
  count: number | null;
}

export interface SongBreakdownData {
  spotifyId: string;
  title: string;
  artist: string;
  /** The week the ratings came from; null when there is no trend data yet. */
  snapshotWeek: string | null;
  features: ScoredFeature[];
}

/** Reads Spotify credentials from the environment. Null when they are not configured. */
export function getSpotifyClient(): SpotifyClient | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new SpotifyClient(clientId, clientSecret);
}

/**
 * Fetch, extract, and score one track. `snapshot` may be null — in that case every
 * feature comes back with a null rating and the UI shows "no trend data yet"
 * rather than failing.
 */
export async function buildSongBreakdown(
  client: SpotifyClient,
  track: { id: string; name: string; artist: string },
  snapshot: FeatureScoreSnapshot | null
): Promise<SongBreakdownData> {
  const { audioFeatures, sections } = await client.getTrackFeatures(track.id);
  const extracted = extractFeatures(audioFeatures, sections);

  const features: ScoredFeature[] = FEATURE_NAMES.map((name) => {
    const value = extracted[name];
    const score = findScore(snapshot, name, value);
    return {
      name,
      value,
      rating: score?.rating ?? null,
      count: score?.count ?? null,
    };
  });

  return {
    spotifyId: track.id,
    title: track.name,
    artist: track.artist,
    snapshotWeek: snapshot?.snapshotWeek ?? null,
    features,
  };
}
