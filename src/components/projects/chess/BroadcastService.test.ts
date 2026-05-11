import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchTopBroadcast,
  fetchStandings,
  computeStandings,
  DEFAULT_INTERVAL,
  BACKOFF_INTERVAL,
} from './BroadcastService';
import type { LichessBroadcast, LichessBroadcastRound } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRound(overrides: Partial<LichessBroadcastRound> = {}): LichessBroadcastRound {
  return { id: 'r1', name: 'Round 1', slug: 'round-1', startsAt: 1000, ...overrides };
}

function makeBroadcast(overrides: Partial<LichessBroadcast> = {}): LichessBroadcast {
  return {
    tour: { id: 'tour1', name: 'Norway Chess 2026', slug: 'norway-chess-2026' },
    rounds: [
      makeRound({ id: 'r1', name: 'Round 1', startsAt: 1000, finished: true, finishedAt: 2000 }),
      makeRound({ id: 'r2', name: 'Round 2', startsAt: 2000, ongoing: true }),
      makeRound({ id: 'r3', name: 'Round 3', startsAt: 3000 }),
    ],
    ...overrides,
  };
}

// Lichess broadcasts endpoint returns NDJSON — one JSON object per line.
function mockBroadcastFetch(
  body: LichessBroadcast[],
  status = 200,
  headers: Record<string, string> = {},
) {
  const ndjson = body.map((b) => JSON.stringify(b)).join('\n');
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => headers[key] ?? null },
    text: () => Promise.resolve(ndjson),
  });
}

// PGN fetch returns plain text.
function mockPgnFetch(pgns: Record<string, string>, status = 200) {
  return vi.fn().mockImplementation(async (url: string) => {
    const roundId = /\/study\/([^.]+)\.pgn/.exec(url)?.[1];
    const body = roundId && pgns[roundId] ? pgns[roundId] : '';
    return {
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(body),
    };
  });
}

const ROUND1_PGN = `[White "Magnus Carlsen"]
[Black "Hikaru Nakamura"]
[Result "1-0"]

1. e4 e5 2. Nf3 *

[White "Fabiano Caruana"]
[Black "Ian Nepomniachtchi"]
[Result "1/2-1/2"]

1. d4 d5 *`;

const ROUND2_PGN = `[White "Hikaru Nakamura"]
[Black "Fabiano Caruana"]
[Result "0-1"]

1. e4 c5 *

[White "Ian Nepomniachtchi"]
[Black "Magnus Carlsen"]
[Result "1/2-1/2"]

1. d4 Nf6 *`;

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── fetchTopBroadcast ─────────────────────────────────────────────────────────

const upcomingBroadcast: LichessBroadcast = {
  tour: { id: 'tour2', name: 'GCT Romania 2026', slug: 'gct-romania-2026' },
  rounds: [
    makeRound({ id: 'u1', name: 'Round 1', startsAt: 9000 }),
    makeRound({ id: 'u2', name: 'Round 2', startsAt: 10000 }),
  ],
};

describe('fetchTopBroadcast', () => {
  it('returns the live broadcast when one has an ongoing round', async () => {
    global.fetch = mockBroadcastFetch([upcomingBroadcast, makeBroadcast()]);

    const result = await fetchTopBroadcast();

    expect(result).not.toBeNull();
    expect(result!.tournamentName).toBe('Norway Chess 2026');
    expect(result!.isLive).toBe(true);
    expect(result!.roundName).toBe('Round 2');
    expect(result!.upcoming).toBeNull(); // no upcoming shown while live
  });

  it('returns the most recently played broadcast when none is live, with upcoming', async () => {
    const completedBroadcast = makeBroadcast({
      rounds: [
        makeRound({ id: 'r1', name: 'Round 1', startsAt: 1000, finished: true }),
        makeRound({ id: 'r2', name: 'Round 2', startsAt: 2000, finished: true }),
      ],
    });
    global.fetch = mockBroadcastFetch([upcomingBroadcast, completedBroadcast]);

    const result = await fetchTopBroadcast();

    expect(result!.tournamentName).toBe('Norway Chess 2026');
    expect(result!.isLive).toBe(false);
    expect(result!.upcoming).not.toBeNull();
    expect(result!.upcoming!.name).toBe('GCT Romania 2026');
    expect(result!.upcoming!.startsAt).toBe(9000);
  });

  it('includes allRounds in the result', async () => {
    global.fetch = mockBroadcastFetch([makeBroadcast()]);

    const result = await fetchTopBroadcast();

    expect(result!.allRounds).toHaveLength(3);
    expect(result!.allRounds[0].id).toBe('r1');
  });

  it('falls back to the last finished round when none is ongoing', async () => {
    const broadcast = makeBroadcast({
      rounds: [
        makeRound({ id: 'r1', name: 'Round 1', startsAt: 1000, finished: true, finishedAt: 2000 }),
        makeRound({ id: 'r2', name: 'Round 2', startsAt: 2000, finished: true, finishedAt: 3000 }),
      ],
    });
    global.fetch = mockBroadcastFetch([broadcast]);

    const result = await fetchTopBroadcast();

    expect(result!.roundName).toBe('Round 2');
  });

  it('returns null when no broadcasts have played rounds', async () => {
    global.fetch = mockBroadcastFetch([upcomingBroadcast]);

    const result = await fetchTopBroadcast();

    expect(result).toBeNull();
  });

  it('returns null when the broadcast list is empty', async () => {
    global.fetch = mockBroadcastFetch([]);

    const result = await fetchTopBroadcast();

    expect(result).toBeNull();
  });

  it('picks the upcoming broadcast with the earliest startsAt', async () => {
    const soonerUpcoming: LichessBroadcast = {
      tour: { id: 'tour3', name: 'Sooner Event', slug: 'sooner' },
      rounds: [makeRound({ id: 's1', startsAt: 500 })],
    };
    const completedBroadcast = makeBroadcast({
      rounds: [makeRound({ id: 'r1', startsAt: 1000, finished: true })],
    });
    global.fetch = mockBroadcastFetch([upcomingBroadcast, soonerUpcoming, completedBroadcast]);

    const result = await fetchTopBroadcast();

    expect(result!.upcoming!.name).toBe('Sooner Event');
  });

  it('applies BACKOFF_INTERVAL when X-RateLimit-Remaining is below threshold', async () => {
    global.fetch = mockBroadcastFetch([makeBroadcast()], 200, { 'X-RateLimit-Remaining': '5' });

    const result = await fetchTopBroadcast();

    expect(result!.pollingInterval).toBe(BACKOFF_INTERVAL);
  });

  it('uses DEFAULT_INTERVAL when X-RateLimit-Remaining is at the threshold', async () => {
    global.fetch = mockBroadcastFetch([makeBroadcast()], 200, { 'X-RateLimit-Remaining': '10' });

    const result = await fetchTopBroadcast();

    expect(result!.pollingInterval).toBe(DEFAULT_INTERVAL);
  });

  it('uses DEFAULT_INTERVAL when X-RateLimit-Remaining header is absent', async () => {
    global.fetch = mockBroadcastFetch([makeBroadcast()]);

    const result = await fetchTopBroadcast();

    expect(result!.pollingInterval).toBe(DEFAULT_INTERVAL);
  });

  it('throws on a non-2xx response', async () => {
    global.fetch = mockBroadcastFetch([], 503);

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

// ── computeStandings ──────────────────────────────────────────────────────────

describe('computeStandings', () => {
  it('computes points, W/D/L, and rank from a single round', () => {
    const standings = computeStandings([ROUND1_PGN]);

    const carlsen = standings.find((p) => p.name === 'Magnus Carlsen')!;
    const nakamura = standings.find((p) => p.name === 'Hikaru Nakamura')!;
    const caruana = standings.find((p) => p.name === 'Fabiano Caruana')!;
    const nepo = standings.find((p) => p.name === 'Ian Nepomniachtchi')!;

    expect(carlsen.wins).toBe(1);
    expect(carlsen.draws).toBe(0);
    expect(carlsen.losses).toBe(0);
    expect(carlsen.points).toBe(1);

    expect(nakamura.wins).toBe(0);
    expect(nakamura.losses).toBe(1);
    expect(nakamura.points).toBe(0);

    expect(caruana.draws).toBe(1);
    expect(caruana.points).toBe(0.5);
    expect(nepo.draws).toBe(1);
    expect(nepo.points).toBe(0.5);
  });

  it('accumulates results across multiple rounds', () => {
    const standings = computeStandings([ROUND1_PGN, ROUND2_PGN]);

    const carlsen = standings.find((p) => p.name === 'Magnus Carlsen')!;
    // R1: beat Nakamura (1pt). R2: drew Nepo (0.5pt). Total: 1.5
    expect(carlsen.points).toBe(1.5);
    expect(carlsen.wins).toBe(1);
    expect(carlsen.draws).toBe(1);
  });

  it('sorts by points descending, then wins descending, then name ascending', () => {
    const standings = computeStandings([ROUND1_PGN, ROUND2_PGN]);
    const points = standings.map((p) => p.points);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  it('assigns sequential ranks starting at 1', () => {
    const standings = computeStandings([ROUND1_PGN]);
    const ranks = standings.map((p) => p.rank);
    expect(ranks).toEqual([1, 2, 3, 4]);
  });

  it('ignores in-progress games (result "*")', () => {
    const pgn = `[White "Alice"]
[Black "Bob"]
[Result "*"]

1. e4`;
    const standings = computeStandings([pgn]);
    expect(standings).toHaveLength(0);
  });

  it('returns empty array when given no PGN texts', () => {
    expect(computeStandings([])).toHaveLength(0);
  });
});

// ── fetchStandings ────────────────────────────────────────────────────────────

describe('fetchStandings', () => {
  it('fetches PGN for finished and ongoing rounds and returns standings', async () => {
    const rounds: LichessBroadcastRound[] = [
      makeRound({ id: 'r1', finished: true }),
      makeRound({ id: 'r2', ongoing: true }),
      makeRound({ id: 'r3' }), // not started — should be skipped
    ];
    global.fetch = mockPgnFetch({ r1: ROUND1_PGN, r2: ROUND2_PGN });

    const standings = await fetchStandings(rounds);

    expect(standings.length).toBeGreaterThan(0);
    // Only r1 and r2 fetched — r3 skipped
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('returns empty standings when no rounds have been played', async () => {
    const rounds: LichessBroadcastRound[] = [
      makeRound({ id: 'r1' }),
      makeRound({ id: 'r2' }),
    ];
    global.fetch = mockPgnFetch({});

    const standings = await fetchStandings(rounds);

    expect(standings).toHaveLength(0);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('throws when a PGN fetch returns a non-2xx status', async () => {
    const rounds: LichessBroadcastRound[] = [makeRound({ id: 'r1', finished: true })];
    global.fetch = mockPgnFetch({}, 503);

    await expect(fetchStandings(rounds)).rejects.toThrow('PGN fetch failed: 503');
  });
});
