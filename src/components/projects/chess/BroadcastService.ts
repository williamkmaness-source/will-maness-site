import { Chess } from 'chess.js';
import type {
  ActiveTournamentOption,
  GameMoveData,
  GamePairing,
  LichessBroadcast,
  LichessBroadcastRound,
  PlayerStanding,
  TopBroadcastResult,
  TournamentFormat,
  UpcomingTournament,
} from './types';

const LICHESS_BASE = 'https://lichess.org/api';
export const DEFAULT_INTERVAL = 60_000;
export const BACKOFF_INTERVAL = 300_000;
const RATE_LIMIT_THRESHOLD = 10;
// Lichess tier scale: 5 = featured marquee events, 4 = national/notable, 3–0 = lower
export const ELITE_TIER = 4;

function hasPlayedRounds(broadcast: LichessBroadcast): boolean {
  return broadcast.rounds.some((r) => r.finished || r.ongoing);
}

// Fallback for when the list API omits finished/ongoing flags on already-started rounds.
function hasStartedRounds(broadcast: LichessBroadcast, now: number): boolean {
  return broadcast.rounds.some((r) => (r.startsAt ?? 0) < now);
}

// Returns active candidates from a set of broadcasts: prefers explicit played-round flags,
// falls back to rounds whose startsAt is in the past when flags are absent.
function candidatesFrom(broadcasts: LichessBroadcast[], now: number): LichessBroadcast[] {
  const played = broadcasts.filter(hasPlayedRounds);
  if (played.length > 0) return played;
  return broadcasts.filter((b) => hasStartedRounds(b, now));
}

export function selectActiveRound(rounds: LichessBroadcastRound[]): LichessBroadcastRound | null {
  return (
    rounds.find((r) => r.ongoing) ??
    rounds.filter((r) => r.finished).at(-1) ??
    rounds.at(-1) ??
    null
  );
}

function resolvePollingInterval(headers: Headers): number {
  const remaining = Number(headers.get('X-RateLimit-Remaining') ?? Infinity);
  return remaining < RATE_LIMIT_THRESHOLD ? BACKOFF_INTERVAL : DEFAULT_INTERVAL;
}

function findUpcoming(broadcasts: LichessBroadcast[]): UpcomingTournament | null {
  const candidates = broadcasts
    .filter((b) => !hasPlayedRounds(b) && b.rounds.length > 0)
    .sort((a, b) => (a.rounds[0].startsAt ?? 0) - (b.rounds[0].startsAt ?? 0));

  if (!candidates.length) return null;
  const next = candidates[0];
  return { name: next.tour.name, startsAt: next.rounds[0].startsAt ?? null };
}

export async function fetchTopBroadcast(
  signal?: AbortSignal,
): Promise<TopBroadcastResult> {
  const res = await fetch(`${LICHESS_BASE}/broadcast?nb=30`, { signal });
  const pollingInterval = resolvePollingInterval(res.headers);

  if (!res.ok) {
    throw new Error(`Lichess API ${res.status}`);
  }

  // The endpoint returns NDJSON (one JSON object per line), not a JSON array.
  const text = await res.text();
  const allBroadcasts: LichessBroadcast[] = text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  // Include all notable events (tier >= 4), but prefer tier-5 marquee events when available.
  const allElite = allBroadcasts.filter((b) => (b.tour.tier ?? 0) >= ELITE_TIER);
  const tier5 = allElite.filter((b) => (b.tour.tier ?? 0) >= 5);
  const tier4 = allElite.filter((b) => (b.tour.tier ?? 0) < 5);

  const now = Date.now();
  const pool5 = candidatesFrom(tier5, now);
  const candidatePool = pool5.length > 0 ? pool5 : candidatesFrom(tier4, now);

  if (!candidatePool.length) {
    // Nothing active — prefer tier-5 upcoming, fall back to any elite upcoming.
    return {
      active: false,
      upcoming: findUpcoming(tier5) ?? findUpcoming(allElite),
      pollingInterval,
    };
  }

  const liveCandidate = candidatePool.find((b) => b.rounds.some((r) => r.ongoing));
  const current = liveCandidate ?? candidatePool[0];
  const isLive = !!liveCandidate;
  const activeRound = selectActiveRound(current.rounds);

  // Upcoming: prefer tier-5 events regardless of which tier is currently active.
  const upcomingEvent = isLive ? null : (findUpcoming(tier5) ?? findUpcoming(allElite));

  // Build the full list of active elite tournaments for the multi-tournament dropdown.
  const allActiveTournaments: ActiveTournamentOption[] = candidatePool.map((b) => ({
    id: b.tour.id,
    name: b.tour.name,
    isLive: b.rounds.some((r) => r.ongoing),
    allRounds: b.rounds,
  }));

  return {
    active: true,
    isLive,
    tournamentName: current.tour.name,
    tournamentId: current.tour.id,
    roundName: activeRound?.name ?? null,
    activeRoundId: activeRound?.id ?? null,
    pollingInterval,
    allRounds: current.rounds,
    upcoming: upcomingEvent,
    allActiveTournaments,
  };
}

// ── PGN parsing ───────────────────────────────────────────────────────────────

function splitGames(pgn: string): string[] {
  return pgn.split(/\n\n(?=\[)/).filter((b) => b.trimStart().startsWith('['));
}

interface RawGameHeaders {
  white?: string;
  black?: string;
  result?: string;
  gameUrl?: string;
}

function extractHeaders(game: string): RawGameHeaders {
  return {
    white: /\[White "([^"]+)"\]/.exec(game)?.[1],
    black: /\[Black "([^"]+)"\]/.exec(game)?.[1],
    result: /\[Result "([^"]+)"\]/.exec(game)?.[1],
    gameUrl:
      /\[GameURL "([^"]+)"\]/.exec(game)?.[1] ??
      /\[Site "([^"]+)"\]/.exec(game)?.[1],
  };
}

export function parsePairings(pgn: string): GamePairing[] {
  return splitGames(pgn).flatMap((game) => {
    const { white, black, result, gameUrl } = extractHeaders(game);
    const gameId = gameUrl?.split('/').at(-1);
    if (!white || !black || !result || !gameId) return [];
    return [
      {
        gameId,
        white,
        black,
        result,
        isCompleted: result === '1-0' || result === '0-1' || result === '1/2-1/2',
      },
    ];
  });
}

export function computeStandings(pgnTexts: string[]): PlayerStanding[] {
  const players = new Map<string, { wins: number; draws: number; losses: number }>();

  function ensure(name: string) {
    if (!players.has(name)) players.set(name, { wins: 0, draws: 0, losses: 0 });
    return players.get(name)!;
  }

  for (const pgn of pgnTexts) {
    for (const game of splitGames(pgn)) {
      const { white, black, result } = extractHeaders(game);
      if (!white || !black || !result) continue;
      if (result === '1-0') {
        ensure(white).wins++;
        ensure(black).losses++;
      } else if (result === '0-1') {
        ensure(black).wins++;
        ensure(white).losses++;
      } else if (result === '1/2-1/2') {
        ensure(white).draws++;
        ensure(black).draws++;
      }
    }
  }

  return Array.from(players.entries())
    .map(([name, { wins, draws, losses }]) => ({
      name,
      wins,
      draws,
      losses,
      points: wins + draws * 0.5,
      rank: 0,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name))
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

export function detectFormat(pgnTexts: string[], standings: PlayerStanding[]): TournamentFormat {
  const n = standings.length;
  if (n < 2) return 'unknown';

  // Collect normalized pairs (sorted player names) per round
  const roundPairSets = pgnTexts.map((pgn) => {
    const pairs = new Set<string>();
    for (const game of splitGames(pgn)) {
      const { white, black } = extractHeaders(game);
      if (white && black) pairs.add([white, black].sort().join('|'));
    }
    return pairs;
  });

  // Repeated pair across any two rounds → knockout (same players face each other multiple times)
  const seen = new Set<string>();
  for (const pairs of roundPairSets) {
    for (const pair of pairs) {
      if (seen.has(pair)) return 'knockout';
      seen.add(pair);
    }
  }

  // Round-robin: even player count, every round has exactly n/2 unique pairings
  if (n % 2 === 0 && roundPairSets.every((pairs) => pairs.size === n / 2)) {
    return 'round-robin';
  }

  return 'unknown';
}

// chess.js v1 fails on multiple consecutive { } comment blocks per move (Lichess includes
// eval + text + clock as separate blocks). Strip all comments before parsing.
// Also normalise 0-0/0-0-0 (zeros) to O-O/O-O-O (letters) that chess.js requires.
function normalizePgn(pgn: string): string {
  return pgn
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\b0-0-0\b/g, 'O-O-O')
    .replace(/\b0-0\b/g, 'O-O')
    .replace(/\s+/g, ' ');
}

// Extract per-move eval and clock annotations from a raw PGN block (before comment stripping).
function parseAnnotations(pgn: string): Array<{ eval: number | null; clock: string | null }> {
  // Split at the blank line that separates PGN headers from moves — avoids stripping
  // [%eval ...] and [%clk ...] annotation tags inside comment blocks.
  const blankLine = pgn.search(/\n\s*\n/);
  const body = (blankLine >= 0 ? pgn.slice(blankLine) : pgn).trim();
  const result: Array<{ eval: number | null; clock: string | null }> = [];
  let current: { eval: number | null; clock: string | null } | null = null;

  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (/\s/.test(ch)) { i++; continue; }

    // Result markers start with 1, 0, or *
    if (ch === '*' || /^(1-0|0-1|1\/2-1\/2)/.test(body.slice(i))) {
      if (current) { result.push(current); current = null; }
      break;
    }

    // Move number (digits + dots), skip
    if (/\d/.test(ch)) {
      while (i < body.length && /[\d.]/.test(body[i])) i++;
      continue;
    }

    // Comment block — extract eval and clock for the current move
    if (ch === '{') {
      let j = i + 1;
      while (j < body.length && body[j] !== '}') j++;
      const comment = body.slice(i + 1, j);
      if (current) {
        const evalMatch = /\[%eval (#-?[\d]+|[+-]?[\d.]+)/.exec(comment);
        const clkMatch = /\[%clk (\d+:\d+:\d+)/.exec(comment);
        if (evalMatch && current.eval === null) {
          const raw = evalMatch[1];
          if (raw.startsWith('#')) {
            current.eval = parseInt(raw.slice(1), 10) > 0 ? Infinity : -Infinity;
          } else {
            const v = parseFloat(raw);
            if (!isNaN(v)) current.eval = v;
          }
        }
        if (clkMatch && current.clock === null) current.clock = clkMatch[1];
      }
      i = j + 1;
      continue;
    }

    // Skip variations
    if (ch === '(') {
      let depth = 1; i++;
      while (i < body.length && depth > 0) {
        if (body[i] === '(') depth++;
        else if (body[i] === ')') depth--;
        i++;
      }
      continue;
    }

    if (ch === ')') { i++; continue; }

    // NAG ($1, $2…), skip
    if (ch === '$') { while (i < body.length && !/\s/.test(body[i])) i++; continue; }

    // SAN move token — push previous annotation, start a new one
    if (current) result.push(current);
    current = { eval: null, clock: null };
    while (i < body.length && !/[\s{()$]/.test(body[i])) i++;
  }

  return result;
}

export function extractGameMoves(roundPgn: string, gameId: string): GameMoveData[] | null {
  const games = splitGames(roundPgn);
  const block = games.find((g) => {
    const url = /\[GameURL "([^"]+)"\]/.exec(g)?.[1] ?? /\[Site "([^"]+)"\]/.exec(g)?.[1];
    return url?.split('/').at(-1) === gameId;
  });
  if (!block) return null;
  try {
    const chess = new Chess();
    chess.loadPgn(normalizePgn(block));
    const verboseMoves = chess.history({ verbose: true });
    const annotations = parseAnnotations(block);
    return verboseMoves.map((move, i) => ({
      san: move.san,
      fen: move.after,
      eval: annotations[i]?.eval ?? null,
      clock: annotations[i]?.clock ?? null,
      captured: move.captured ?? null,
    }));
  } catch {
    return null;
  }
}

export async function fetchGamePgn(
  roundId: string,
  gameId: string,
  signal?: AbortSignal,
): Promise<GameMoveData[]> {
  const res = await fetch(`${LICHESS_BASE}/study/${roundId}.pgn`, { signal });
  if (!res.ok) throw new Error(`PGN fetch failed: ${res.status}`);
  const text = await res.text();
  const moves = extractGameMoves(text, gameId);
  if (!moves) throw new Error(`Game ${gameId} not found in round ${roundId}`);
  return moves;
}

export async function fetchGamePgnLive(
  roundId: string,
  gameId: string,
  signal?: AbortSignal,
): Promise<{ moves: GameMoveData[]; isComplete: boolean; pollingInterval: number }> {
  const res = await fetch(`${LICHESS_BASE}/study/${roundId}.pgn`, { signal });
  if (!res.ok) throw new Error(`PGN fetch failed: ${res.status}`);
  const pollingInterval = resolvePollingInterval(res.headers);
  const text = await res.text();
  const games = splitGames(text);
  const block = games.find((g) => {
    const url = /\[GameURL "([^"]+)"\]/.exec(g)?.[1] ?? /\[Site "([^"]+)"\]/.exec(g)?.[1];
    return url?.split('/').at(-1) === gameId;
  });
  const moves = block ? (extractGameMoves(text, gameId) ?? []) : [];
  const result = block ? (/\[Result "([^"]+)"\]/.exec(block)?.[1] ?? '*') : '*';
  const isComplete = result !== '*';
  return { moves, isComplete, pollingInterval };
}

export async function fetchRoundData(
  rounds: LichessBroadcastRound[],
  activeRoundId: string | null,
  signal?: AbortSignal,
): Promise<{ standings: PlayerStanding[]; pairings: GamePairing[]; pgnTexts: string[] }> {
  const playedRounds = rounds.filter((r) => r.finished || r.ongoing);
  if (!playedRounds.length) return { standings: [], pairings: [], pgnTexts: [] };

  const pgnTexts = await Promise.all(
    playedRounds.map((r) =>
      fetch(`${LICHESS_BASE}/study/${r.id}.pgn`, { signal }).then((res) => {
        if (!res.ok) throw new Error(`PGN fetch failed: ${res.status}`);
        return res.text();
      }),
    ),
  );

  const standings = computeStandings(pgnTexts);

  const activeIndex = playedRounds.findIndex((r) => r.id === activeRoundId);
  const pairings = activeIndex >= 0 ? parsePairings(pgnTexts[activeIndex]) : [];

  return { standings, pairings, pgnTexts };
}
