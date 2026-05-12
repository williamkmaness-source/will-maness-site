import { Chess } from 'chess.js';
import type {
  GamePairing,
  LichessBroadcast,
  LichessBroadcastRound,
  PlayerStanding,
  TopBroadcastResult,
  UpcomingTournament,
} from './types';

const LICHESS_BASE = 'https://lichess.org/api';
export const DEFAULT_INTERVAL = 60_000;
export const BACKOFF_INTERVAL = 300_000;
const RATE_LIMIT_THRESHOLD = 10;

function hasPlayedRounds(broadcast: LichessBroadcast): boolean {
  return broadcast.rounds.some((r) => r.finished || r.ongoing);
}

function selectActiveRound(broadcast: LichessBroadcast): LichessBroadcastRound | null {
  const { rounds } = broadcast;
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
  return { name: next.tour.name, startsAt: next.rounds[0].startsAt };
}

export async function fetchTopBroadcast(
  signal?: AbortSignal,
): Promise<TopBroadcastResult | null> {
  const res = await fetch(`${LICHESS_BASE}/broadcast?nb=20`, { signal });
  const pollingInterval = resolvePollingInterval(res.headers);

  if (!res.ok) {
    throw new Error(`Lichess API ${res.status}`);
  }

  // The endpoint returns NDJSON (one JSON object per line), not a JSON array.
  const text = await res.text();
  const broadcasts: LichessBroadcast[] = text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  if (!broadcasts.length) return null;

  const played = broadcasts.filter(hasPlayedRounds);
  if (!played.length) return null;

  const liveCandidate = played.find((b) => b.rounds.some((r) => r.ongoing));
  const current = liveCandidate ?? played[0];
  const isLive = !!liveCandidate;

  const activeRound = selectActiveRound(current);
  const upcoming = isLive ? null : findUpcoming(broadcasts);

  return {
    isLive,
    tournamentName: current.tour.name,
    tournamentId: current.tour.id,
    roundName: activeRound?.name ?? null,
    activeRoundId: activeRound?.id ?? null,
    pollingInterval,
    allRounds: current.rounds,
    upcoming,
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

export function detectRoundRobin(standings: PlayerStanding[], pairings: GamePairing[]): boolean {
  const n = standings.length;
  if (n < 2 || pairings.length === 0) return true;
  if (n % 2 !== 0 || pairings.length !== n / 2) return false;
  const knownPlayers = new Set(standings.map((p) => p.name));
  const pairingPlayers = pairings.flatMap((p) => [p.white, p.black]);
  return new Set(pairingPlayers).size === n && pairingPlayers.every((name) => knownPlayers.has(name));
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

export function extractGameMoves(roundPgn: string, gameId: string): string[] | null {
  const games = splitGames(roundPgn);
  const block = games.find((g) => {
    const url = /\[GameURL "([^"]+)"\]/.exec(g)?.[1] ?? /\[Site "([^"]+)"\]/.exec(g)?.[1];
    return url?.split('/').at(-1) === gameId;
  });
  if (!block) return null;
  try {
    const chess = new Chess();
    chess.loadPgn(normalizePgn(block));
    return chess.history();
  } catch {
    return null;
  }
}

export async function fetchGamePgn(
  roundId: string,
  gameId: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const res = await fetch(`${LICHESS_BASE}/study/${roundId}.pgn`, { signal });
  if (!res.ok) throw new Error(`PGN fetch failed: ${res.status}`);
  const text = await res.text();
  const moves = extractGameMoves(text, gameId);
  if (!moves) throw new Error(`Game ${gameId} not found in round ${roundId}`);
  return moves;
}

export async function fetchRoundData(
  rounds: LichessBroadcastRound[],
  activeRoundId: string | null,
  signal?: AbortSignal,
): Promise<{ standings: PlayerStanding[]; pairings: GamePairing[] }> {
  const playedRounds = rounds.filter((r) => r.finished || r.ongoing);
  if (!playedRounds.length) return { standings: [], pairings: [] };

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

  return { standings, pairings };
}
