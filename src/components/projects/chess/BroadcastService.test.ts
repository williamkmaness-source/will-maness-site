import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchTopBroadcast, DEFAULT_INTERVAL, BACKOFF_INTERVAL } from './BroadcastService';
import type { LichessBroadcast } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBroadcast(overrides: Partial<LichessBroadcast> = {}): LichessBroadcast {
  return {
    tour: { id: 'tour1', name: 'Norway Chess 2026', slug: 'norway-chess-2026' },
    rounds: [
      { id: 'r1', name: 'Round 1', slug: 'round-1', startsAt: 1000, finished: true, finishedAt: 2000 },
      { id: 'r2', name: 'Round 2', slug: 'round-2', startsAt: 2000, ongoing: true },
      { id: 'r3', name: 'Round 3', slug: 'round-3', startsAt: 3000 },
    ],
    ...overrides,
  };
}

// Lichess returns NDJSON — serialise the body as one JSON object per line.
function mockFetch(body: LichessBroadcast[] | null, status = 200, headers: Record<string, string> = {}) {
  const ndjson = body ? body.map((b) => JSON.stringify(b)).join('\n') : '';
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => headers[key] ?? null,
    },
    text: () => Promise.resolve(ndjson),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('fetchTopBroadcast', () => {
  it('returns the top broadcast with the ongoing round selected', async () => {
    global.fetch = mockFetch([makeBroadcast()]);

    const result = await fetchTopBroadcast();

    expect(result).not.toBeNull();
    expect(result!.tournamentName).toBe('Norway Chess 2026');
    expect(result!.tournamentId).toBe('tour1');
    expect(result!.roundName).toBe('Round 2'); // ongoing round
    expect(result!.pollingInterval).toBe(DEFAULT_INTERVAL);
  });

  it('falls back to the last finished round when none is ongoing', async () => {
    const broadcast = makeBroadcast({
      rounds: [
        { id: 'r1', name: 'Round 1', slug: 'round-1', startsAt: 1000, finished: true, finishedAt: 2000 },
        { id: 'r2', name: 'Round 2', slug: 'round-2', startsAt: 2000, finished: true, finishedAt: 3000 },
      ],
    });
    global.fetch = mockFetch([broadcast]);

    const result = await fetchTopBroadcast();

    expect(result!.roundName).toBe('Round 2');
  });

  it('falls back to the last round when none is finished or ongoing', async () => {
    const broadcast = makeBroadcast({
      rounds: [
        { id: 'r1', name: 'Round 1', slug: 'round-1', startsAt: 1000 },
        { id: 'r2', name: 'Round 2', slug: 'round-2', startsAt: 2000 },
      ],
    });
    global.fetch = mockFetch([broadcast]);

    const result = await fetchTopBroadcast();

    expect(result!.roundName).toBe('Round 2');
  });

  it('returns null when the broadcast list is empty', async () => {
    global.fetch = mockFetch([]);

    const result = await fetchTopBroadcast();

    expect(result).toBeNull();
  });

  it('applies BACKOFF_INTERVAL when X-RateLimit-Remaining is below threshold', async () => {
    global.fetch = mockFetch([makeBroadcast()], 200, { 'X-RateLimit-Remaining': '5' });

    const result = await fetchTopBroadcast();

    expect(result!.pollingInterval).toBe(BACKOFF_INTERVAL);
  });

  it('uses DEFAULT_INTERVAL when X-RateLimit-Remaining is at the threshold', async () => {
    global.fetch = mockFetch([makeBroadcast()], 200, { 'X-RateLimit-Remaining': '10' });

    const result = await fetchTopBroadcast();

    expect(result!.pollingInterval).toBe(DEFAULT_INTERVAL);
  });

  it('uses DEFAULT_INTERVAL when X-RateLimit-Remaining header is absent', async () => {
    global.fetch = mockFetch([makeBroadcast()]);

    const result = await fetchTopBroadcast();

    expect(result!.pollingInterval).toBe(DEFAULT_INTERVAL);
  });

  it('throws on a non-2xx response', async () => {
    global.fetch = mockFetch([], 503);

    await expect(fetchTopBroadcast()).rejects.toThrow('Lichess API 503');
  });

  it('propagates network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    await expect(fetchTopBroadcast()).rejects.toThrow('Network failure');
  });

  it('respects the abort signal', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    global.fetch = vi.fn().mockRejectedValue(abortError);

    const controller = new AbortController();
    controller.abort();

    await expect(fetchTopBroadcast(controller.signal)).rejects.toThrow('Aborted');
  });
});
