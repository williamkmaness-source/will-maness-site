import type { LichessBroadcast, LichessBroadcastRound, PlayerStanding, TopBroadcastResult } from './types';

const LICHESS_BASE = 'https://lichess.org/api';
export const DEFAULT_INTERVAL = 60_000;
export const BACKOFF_INTERVAL = 300_000;
const RATE_LIMIT_THRESHOLD = 10;

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

export async function fetchTopBroadcast(
  signal?: AbortSignal,
): Promise<TopBroadcastResult | null> {
  const res = await fetch(`${LICHESS_BASE}/broadcast?nb=10`, { signal });
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

  const top = broadcasts[0];
  const activeRound = selectActiveRound(top);

  return {
    tournamentName: top.tour.name,
    tournamentId: top.tour.id,
    roundName: activeRound?.name ?? null,
    pollingInterval,
    allRounds: top.rounds,
  };
}

// ── Standings computation ─────────────────────────────────────────────────────

interface GameResult {
  white: string;
  black: string;
  result: string;
}

function parseGameResults(pgn: string): GameResult[] {
  const games = pgn.split(/\n\n(?=\[)/).filter((b) => b.trimStart().startsWith('['));
  return games.flatMap((game) => {
    const white = /\[White "([^"]+)"\]/.exec(game)?.[1];
    const black = /\[Black "([^"]+)"\]/.exec(game)?.[1];
    const result = /\[Result "([^"]+)"\]/.exec(game)?.[1];
    return white && black && result ? [{ white, black, result }] : [];
  });
}

export function computeStandings(pgnTexts: string[]): PlayerStanding[] {
  const players = new Map<string, { wins: number; draws: number; losses: number }>();

  function ensure(name: string) {
    if (!players.has(name)) players.set(name, { wins: 0, draws: 0, losses: 0 });
    return players.get(name)!;
  }

  for (const pgn of pgnTexts) {
    for (const { white, black, result } of parseGameResults(pgn)) {
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
      // '*' (game in progress) — omit from standings
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

export async function fetchStandings(
  rounds: LichessBroadcastRound[],
  signal?: AbortSignal,
): Promise<PlayerStanding[]> {
  const playedRounds = rounds.filter((r) => r.finished || r.ongoing);
  if (!playedRounds.length) return [];

  const pgnTexts = await Promise.all(
    playedRounds.map((r) =>
      fetch(`${LICHESS_BASE}/study/${r.id}.pgn`, { signal }).then((res) => {
        if (!res.ok) throw new Error(`PGN fetch failed: ${res.status}`);
        return res.text();
      }),
    ),
  );

  return computeStandings(pgnTexts);
}
