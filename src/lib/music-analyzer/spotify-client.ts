// spotify-client.ts — Server-side Spotify Web API client using the client credentials flow (issue #214).
// Reads SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET; the access token is never exposed to the browser.

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
}

export interface SpotifyAudioFeatures {
  key: number; // 0–11 pitch class
  mode: number; // 0 = minor, 1 = major
  tempo: number; // BPM
}

export interface SpotifyAudioAnalysisSection {
  key: number;
  mode: number;
}

export interface SpotifyTrackFeatures {
  audioFeatures: SpotifyAudioFeatures;
  sections: SpotifyAudioAnalysisSection[];
}

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE_URL = "https://api.spotify.com/v1";
const TOKEN_TTL_MS = 55 * 60 * 1000; // Spotify tokens last 1 hour; refresh a few minutes early.

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function fetchAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Spotify token request failed with HTTP ${res.status}`);

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const accessToken = await fetchAccessToken(clientId, clientSecret);
  cachedToken = { accessToken, expiresAt: Date.now() + TOKEN_TTL_MS };
  return accessToken;
}

export class SpotifyClient {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  private async request<T>(path: string): Promise<T> {
    const token = await getAccessToken(this.clientId, this.clientSecret);

    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`Spotify API request to ${path} failed with HTTP ${res.status}`);

    return res.json() as Promise<T>;
  }

  async searchTrack(query: string): Promise<SpotifyTrack[]> {
    const params = new URLSearchParams({ q: query, type: "track", limit: "10" });
    const data = await this.request<{
      tracks: { items: { id: string; name: string; artists: { name: string }[] }[] };
    }>(`/search?${params.toString()}`);

    return data.tracks.items.map((item) => ({
      id: item.id,
      name: item.name,
      artist: item.artists[0]?.name ?? "Unknown",
    }));
  }

  async getTrackFeatures(spotifyId: string): Promise<SpotifyTrackFeatures> {
    const [audioFeatures, analysis] = await Promise.all([
      this.request<{ key: number; mode: number; tempo: number }>(
        `/audio-features/${spotifyId}`
      ),
      this.request<{ sections: { key: number; mode: number }[] }>(
        `/audio-analysis/${spotifyId}`
      ),
    ]);

    return {
      audioFeatures: {
        key: audioFeatures.key,
        mode: audioFeatures.mode,
        tempo: audioFeatures.tempo,
      },
      sections: analysis.sections.map((section) => ({
        key: section.key,
        mode: section.mode,
      })),
    };
  }
}
