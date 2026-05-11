import type { LichessBroadcast, TopBroadcastResult } from './types';

const LICHESS_BASE = 'https://lichess.org/api';
export const DEFAULT_INTERVAL = 60_000;
export const BACKOFF_INTERVAL = 300_000;
const RATE_LIMIT_THRESHOLD = 10;

function selectActiveRound(broadcast: LichessBroadcast) {
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

  const broadcasts: LichessBroadcast[] = await res.json();

  if (!broadcasts.length) return null;

  const top = broadcasts[0];
  const activeRound = selectActiveRound(top);

  return {
    tournamentName: top.tour.name,
    tournamentId: top.tour.id,
    roundName: activeRound?.name ?? null,
    pollingInterval,
  };
}
