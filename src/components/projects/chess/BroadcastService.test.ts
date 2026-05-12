import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchTopBroadcast,
  fetchRoundData,
  fetchGamePgn,
  parsePairings,
  computeStandings,
  detectRoundRobin,
  extractGameMoves,
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
    expect(result!.activeRoundId).toBe('r2');
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

// ── parsePairings ─────────────────────────────────────────────────────────────

const PAIRINGS_PGN = `[White "Magnus Carlsen"]
[Black "Hikaru Nakamura"]
[Result "1-0"]
[GameURL "https://lichess.org/broadcast/tour/round-1/abc123/gameAAA"]

1. e4 e5 *

[White "Fabiano Caruana"]
[Black "Ian Nepomniachtchi"]
[Result "*"]
[GameURL "https://lichess.org/broadcast/tour/round-1/abc123/gameBBB"]

1. d4 d5 *`;

describe('parsePairings', () => {
  it('extracts white, black, result, and gameId from each game block', () => {
    const pairings = parsePairings(PAIRINGS_PGN);

    expect(pairings).toHaveLength(2);
    expect(pairings[0]).toMatchObject({
      white: 'Magnus Carlsen',
      black: 'Hikaru Nakamura',
      result: '1-0',
      gameId: 'gameAAA',
      isCompleted: true,
    });
    expect(pairings[1]).toMatchObject({
      result: '*',
      gameId: 'gameBBB',
      isCompleted: false,
    });
  });

  it('marks 0-1 and 1/2-1/2 results as completed', () => {
    const pgn = `[White "A"]
[Black "B"]
[Result "0-1"]
[GameURL "https://lichess.org/broadcast/t/r/round/game1"]

1. e4 *

[White "C"]
[Black "D"]
[Result "1/2-1/2"]
[GameURL "https://lichess.org/broadcast/t/r/round/game2"]

1. d4 *`;

    const pairings = parsePairings(pgn);
    expect(pairings[0].isCompleted).toBe(true);
    expect(pairings[1].isCompleted).toBe(true);
  });

  it('falls back to Site header when GameURL is absent', () => {
    const pgn = `[White "A"]
[Black "B"]
[Result "1-0"]
[Site "https://lichess.org/broadcast/t/r/round/siteGame"]

1. e4 *`;

    const pairings = parsePairings(pgn);
    expect(pairings[0].gameId).toBe('siteGame');
  });

  it('returns empty array for empty PGN', () => {
    expect(parsePairings('')).toHaveLength(0);
  });
});

// ── fetchRoundData ────────────────────────────────────────────────────────────

describe('fetchRoundData', () => {
  it('returns standings and pairings for the active round', async () => {
    const rounds: LichessBroadcastRound[] = [
      makeRound({ id: 'r1', finished: true }),
      makeRound({ id: 'r2', ongoing: true }),
      makeRound({ id: 'r3' }),
    ];
    global.fetch = mockPgnFetch({ r1: ROUND1_PGN, r2: PAIRINGS_PGN });

    const { standings, pairings } = await fetchRoundData(rounds, 'r2');

    expect(standings.length).toBeGreaterThan(0);
    expect(pairings).toHaveLength(2);
    expect(pairings[0].white).toBe('Magnus Carlsen');
    // Only r1 and r2 fetched — r3 skipped
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('returns empty pairings when activeRoundId is not in played rounds', async () => {
    const rounds: LichessBroadcastRound[] = [makeRound({ id: 'r1', finished: true })];
    global.fetch = mockPgnFetch({ r1: ROUND1_PGN });

    const { pairings } = await fetchRoundData(rounds, 'r_unknown');

    expect(pairings).toHaveLength(0);
  });

  it('returns empty results when no rounds have been played', async () => {
    const rounds: LichessBroadcastRound[] = [makeRound({ id: 'r1' })];
    global.fetch = mockPgnFetch({});

    const { standings, pairings } = await fetchRoundData(rounds, 'r1');

    expect(standings).toHaveLength(0);
    expect(pairings).toHaveLength(0);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('throws when a PGN fetch returns a non-2xx status', async () => {
    const rounds: LichessBroadcastRound[] = [makeRound({ id: 'r1', finished: true })];
    global.fetch = mockPgnFetch({}, 503);

    await expect(fetchRoundData(rounds, 'r1')).rejects.toThrow('PGN fetch failed: 503');
  });
});

// ── detectRoundRobin ──────────────────────────────────────────────────────────

const rrStandings = [
  { rank: 1, name: 'Alice', points: 1, wins: 1, draws: 0, losses: 0 },
  { rank: 2, name: 'Bob', points: 0, wins: 0, draws: 0, losses: 1 },
  { rank: 3, name: 'Carol', points: 0.5, wins: 0, draws: 1, losses: 0 },
  { rank: 4, name: 'Dave', points: 0.5, wins: 0, draws: 1, losses: 0 },
];

const rrPairings = [
  { gameId: 'g1', white: 'Alice', black: 'Bob', result: '1-0', isCompleted: true },
  { gameId: 'g2', white: 'Carol', black: 'Dave', result: '1/2-1/2', isCompleted: true },
];

describe('detectRoundRobin', () => {
  it('returns true for a well-formed round-robin round', () => {
    expect(detectRoundRobin(rrStandings, rrPairings)).toBe(true);
  });

  it('returns true when there are no pairings yet (insufficient data)', () => {
    expect(detectRoundRobin(rrStandings, [])).toBe(true);
  });

  it('returns true when standings are empty (insufficient data)', () => {
    expect(detectRoundRobin([], rrPairings)).toBe(true);
  });

  it('returns false when pairings count does not equal n/2', () => {
    const extraPairing = [...rrPairings, { gameId: 'g3', white: 'Alice', black: 'Carol', result: '*', isCompleted: false }];
    expect(detectRoundRobin(rrStandings, extraPairing)).toBe(false);
  });

  it('returns false when a pairing player is not in standings', () => {
    const unknownPairing = [
      { gameId: 'g1', white: 'Alice', black: 'Unknown', result: '1-0', isCompleted: true },
      { gameId: 'g2', white: 'Carol', black: 'Dave', result: '1/2-1/2', isCompleted: true },
    ];
    expect(detectRoundRobin(rrStandings, unknownPairing)).toBe(false);
  });

  it('returns false when the same player appears twice in pairings', () => {
    const duplicatePairing = [
      { gameId: 'g1', white: 'Alice', black: 'Bob', result: '1-0', isCompleted: true },
      { gameId: 'g2', white: 'Alice', black: 'Dave', result: '1/2-1/2', isCompleted: true },
    ];
    expect(detectRoundRobin(rrStandings, duplicatePairing)).toBe(false);
  });

  it('returns false when player count is odd', () => {
    const oddStandings = rrStandings.slice(0, 3);
    expect(detectRoundRobin(oddStandings, rrPairings)).toBe(false);
  });
});

// ── extractGameMoves ──────────────────────────────────────────────────────────

const MULTI_GAME_PGN = `[White "Magnus Carlsen"]
[Black "Hikaru Nakamura"]
[Result "1-0"]
[GameURL "https://lichess.org/broadcast/t/r/round/gameAAA"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 *

[White "Fabiano Caruana"]
[Black "Ian Nepomniachtchi"]
[Result "1/2-1/2"]
[GameURL "https://lichess.org/broadcast/t/r/round/gameBBB"]

1. d4 d5 2. c4 *`;

describe('extractGameMoves', () => {
  it('returns GameMoveData with san and fen for the matching gameId', () => {
    const moves = extractGameMoves(MULTI_GAME_PGN, 'gameAAA');
    expect(moves).not.toBeNull();
    expect(moves!.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    expect(moves![0].fen).toBeTruthy();
  });

  it('returns moves for the second game when first is skipped', () => {
    const moves = extractGameMoves(MULTI_GAME_PGN, 'gameBBB');
    expect(moves!.map((m) => m.san)).toEqual(['d4', 'd5', 'c4']);
  });

  it('returns null when the gameId is not in the PGN', () => {
    expect(extractGameMoves(MULTI_GAME_PGN, 'gameXXX')).toBeNull();
  });

  it('falls back to Site header when GameURL is absent', () => {
    const pgn = `[White "A"]
[Black "B"]
[Result "1-0"]
[Site "https://lichess.org/broadcast/t/r/round/siteGame"]

1. e4 *`;
    expect(extractGameMoves(pgn, 'siteGame')!.map((m) => m.san)).toEqual(['e4']);
  });

  it('normalizes 0-0/0-0-0 castling notation to O-O/O-O-O before parsing', () => {
    const pgn = `[White "A"]
[Black "B"]
[Result "1-0"]
[GameURL "https://lichess.org/broadcast/t/r/round/castleGame"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. 0-0 Nf6 5. d3 0-0 1-0`;
    const moves = extractGameMoves(pgn, 'castleGame');
    expect(moves).not.toBeNull();
    expect(moves!.some((m) => m.san === 'O-O')).toBe(true);
  });

  it('extracts eval and clock annotations from Lichess multi-comment format', () => {
    const pgn = `[White "A"]
[Black "B"]
[Result "1/2-1/2"]
[GameURL "https://lichess.org/broadcast/t/r/round/commentGame"]

1. e4 { [%eval 0.18] [%clk 1:30:57] } 1... e5 { [%eval 0.22] [%clk 1:30:53] } 2. Nf3?! { [%eval 0.44] } { Inaccuracy. d4 was best. } { [%clk 1:15:08] } 2... Nc6 1/2-1/2`;
    const moves = extractGameMoves(pgn, 'commentGame')!;
    expect(moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(moves[0].eval).toBe(0.18);
    expect(moves[0].clock).toBe('1:30:57');
    expect(moves[2].eval).toBe(0.44);
    expect(moves[2].clock).toBe('1:15:08');
    expect(moves[3].eval).toBeNull();
  });

  it('returns captured piece for a capture move', () => {
    const pgn = `[White "A"]
[Black "B"]
[Result "1-0"]
[GameURL "https://lichess.org/broadcast/t/r/round/captureGame"]

1. e4 d5 2. exd5 1-0`;
    const moves = extractGameMoves(pgn, 'captureGame')!;
    expect(moves[2].captured).toBe('p');
  });

  it('returns an empty array for a game with no moves', () => {
    const pgn = `[White "A"]
[Black "B"]
[Result "*"]
[GameURL "https://lichess.org/broadcast/t/r/round/emptyGame"]

*`;
    expect(extractGameMoves(pgn, 'emptyGame')).toEqual([]);
  });
});

// ── fetchGamePgn ──────────────────────────────────────────────────────────────

describe('fetchGamePgn', () => {
  it('returns GameMoveData array for the requested game', async () => {
    global.fetch = mockPgnFetch({ r1: MULTI_GAME_PGN });

    const moves = await fetchGamePgn('r1', 'gameAAA');
    expect(moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
  });

  it('throws when the game is not found in the round PGN', async () => {
    global.fetch = mockPgnFetch({ r1: MULTI_GAME_PGN });

    await expect(fetchGamePgn('r1', 'gameXXX')).rejects.toThrow('not found in round');
  });

  it('throws on a non-2xx response', async () => {
    global.fetch = mockPgnFetch({}, 503);

    await expect(fetchGamePgn('r1', 'gameAAA')).rejects.toThrow('PGN fetch failed: 503');
  });
});
