// Tests for the Spotify client (issue #214).
// Mocks global fetch — no real network calls, no live credentials required.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpotifyClient } from "./spotify-client";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("SpotifyClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetches and caches an access token, reusing it across calls", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-1" }))
      .mockResolvedValueOnce(jsonResponse({ tracks: { items: [] } }))
      .mockResolvedValueOnce(jsonResponse({ tracks: { items: [] } }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new SpotifyClient("id", "secret");
    await client.searchTrack("song a");
    await client.searchTrack("song b");

    const tokenCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("accounts.spotify.com/api/token")
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it("searchTrack maps Spotify results to a flat track list", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        tracks: {
          items: [
            { id: "abc123", name: "Test Song", artists: [{ name: "Test Artist" }] },
          ],
        },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new SpotifyClient("id", "secret");
    const results = await client.searchTrack("test song");

    expect(results).toEqual([{ id: "abc123", name: "Test Song", artist: "Test Artist" }]);
  });

  it("getTrackFeatures returns typed audio features and sections", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/audio-features/")) {
        return Promise.resolve(jsonResponse({ key: 2, mode: 0, tempo: 128 }));
      }
      if (url.includes("/audio-analysis/")) {
        return Promise.resolve(jsonResponse({ sections: [{ key: 2, mode: 0 }] }));
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new SpotifyClient("id", "secret");
    const result = await client.getTrackFeatures("abc123");

    expect(result).toEqual({
      audioFeatures: { key: 2, mode: 0, tempo: 128 },
      sections: [{ key: 2, mode: 0 }],
    });
  });

  it("throws when the Spotify API returns a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({}, false, 429));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new SpotifyClient("id", "secret");
    await expect(client.searchTrack("test")).rejects.toThrow("HTTP 429");
  });
});
