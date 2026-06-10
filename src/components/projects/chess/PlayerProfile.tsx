'use client';

import { useEffect, useRef, useState } from 'react';

type BroadcastPlayer = {
  name: string;
  title?: string;
  rating?: number;
  fideId?: number;
  fed?: string;
};

type LichessPerf = {
  games: number;
  rating: number;
  rd: number;
  prov?: boolean;
};

type LichessUser = {
  id: string;
  username: string;
  title?: string;
  perfs: {
    classical?: LichessPerf;
    rapid?: LichessPerf;
    blitz?: LichessPerf;
    bullet?: LichessPerf;
    correspondence?: LichessPerf;
  };
};

const DISPLAY_VARIANTS: Array<{ key: keyof LichessUser['perfs']; label: string }> = [
  { key: 'classical', label: 'Classical' },
  { key: 'rapid', label: 'Rapid' },
  { key: 'blitz', label: 'Blitz' },
  { key: 'bullet', label: 'Bullet' },
];

type TournamentResult = {
  id: string;
  fullName: string;
  nbGames: number;
  score: number;
  rank: number;
  perf?: { key: string; name: string };
  tourRating?: number;
};

const broadcastCache = new Map<string, BroadcastPlayer[]>();
const lichessCache = new Map<string, LichessUser | null>();
const tournamentResultsCache = new Map<string, TournamentResult[]>();

async function fetchBroadcastPlayers(roundId: string): Promise<BroadcastPlayer[]> {
  if (broadcastCache.has(roundId)) return broadcastCache.get(roundId)!;

  try {
    const res = await fetch(`https://lichess.org/api/broadcast/-/-/${roundId}`);
    if (!res.ok) { broadcastCache.set(roundId, []); return []; }
    const data = await res.json();
    const games: Array<{ players?: BroadcastPlayer[] }> = data.games ?? [];
    const players: BroadcastPlayer[] = [];
    const seen = new Set<string>();
    for (const game of games) {
      for (const p of game.players ?? []) {
        if (p.name && !seen.has(p.name)) {
          seen.add(p.name);
          players.push(p);
        }
      }
    }
    broadcastCache.set(roundId, players);
    return players;
  } catch {
    broadcastCache.set(roundId, []);
    return [];
  }
}

function findBroadcastPlayer(players: BroadcastPlayer[], displayName: string): BroadcastPlayer | null {
  return players.find((p) => p.name === displayName) ?? null;
}

async function fetchTournamentResults(username: string): Promise<TournamentResult[]> {
  const key = username.toLowerCase();
  if (tournamentResultsCache.has(key)) return tournamentResultsCache.get(key)!;

  try {
    const res = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(key)}/tournament/results?nb=10`,
      { headers: { Accept: 'application/x-ndjson' } },
    );
    if (!res.ok) { tournamentResultsCache.set(key, []); return []; }
    const text = await res.text();
    const results: TournamentResult[] = text
      .split('\n')
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line) as TournamentResult; } catch { return null; } })
      .filter((r): r is TournamentResult => r !== null);
    tournamentResultsCache.set(key, results);
    return results;
  } catch {
    tournamentResultsCache.set(key, []);
    return [];
  }
}

async function fetchLichessUser(username: string): Promise<LichessUser | null> {
  const key = username.toLowerCase();
  if (lichessCache.has(key)) return lichessCache.get(key)!;

  try {
    const res = await fetch(`https://lichess.org/api/user/${encodeURIComponent(key)}`);
    if (!res.ok) { lichessCache.set(key, null); return null; }
    const data = (await res.json()) as LichessUser;
    if (!data.perfs) { lichessCache.set(key, null); return null; }
    lichessCache.set(key, data);
    return data;
  } catch {
    lichessCache.set(key, null);
    return null;
  }
}

interface Props {
  displayName: string;
  roundIds?: string[];
  onClose: () => void;
}

type Status = 'loading' | 'ready' | 'not-found' | 'error';

function formatPlayerName(displayName: string): string {
  const parts = displayName.split(',').map((s) => s.trim());
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
  return displayName;
}

const FLAG_EMOJI: Record<string, string> = {
  NOR: '\u{1F1F3}\u{1F1F4}', USA: '\u{1F1FA}\u{1F1F8}', IND: '\u{1F1EE}\u{1F1F3}',
  FRA: '\u{1F1EB}\u{1F1F7}', CHN: '\u{1F1E8}\u{1F1F3}', RUS: '\u{1F1F7}\u{1F1FA}',
  GER: '\u{1F1E9}\u{1F1EA}', AZE: '\u{1F1E6}\u{1F1FF}', UZB: '\u{1F1FA}\u{1F1FF}',
  ARM: '\u{1F1E6}\u{1F1F2}', POL: '\u{1F1F5}\u{1F1F1}', NED: '\u{1F1F3}\u{1F1F1}',
  ESP: '\u{1F1EA}\u{1F1F8}', HUN: '\u{1F1ED}\u{1F1FA}', IRN: '\u{1F1EE}\u{1F1F7}',
  CZE: '\u{1F1E8}\u{1F1FF}', SRB: '\u{1F1F7}\u{1F1F8}', ROU: '\u{1F1F7}\u{1F1F4}',
  UKR: '\u{1F1FA}\u{1F1E6}', GEO: '\u{1F1EC}\u{1F1EA}', BRA: '\u{1F1E7}\u{1F1F7}',
  ARG: '\u{1F1E6}\u{1F1F7}', CUB: '\u{1F1E8}\u{1F1FA}', AUS: '\u{1F1E6}\u{1F1FA}',
  CAN: '\u{1F1E8}\u{1F1E6}', ISR: '\u{1F1EE}\u{1F1F1}', TUR: '\u{1F1F9}\u{1F1F7}',
  ITA: '\u{1F1EE}\u{1F1F9}', PER: '\u{1F1F5}\u{1F1EA}', PHI: '\u{1F1F5}\u{1F1ED}',
  VIE: '\u{1F1FB}\u{1F1F3}', KOR: '\u{1F1F0}\u{1F1F7}', JPN: '\u{1F1EF}\u{1F1F5}',
  MGL: '\u{1F1F2}\u{1F1F3}', KAZ: '\u{1F1F0}\u{1F1FF}', SWE: '\u{1F1F8}\u{1F1EA}',
  FIN: '\u{1F1EB}\u{1F1EE}', DEN: '\u{1F1E9}\u{1F1F0}', BEL: '\u{1F1E7}\u{1F1EA}',
  SUI: '\u{1F1E8}\u{1F1ED}', AUT: '\u{1F1E6}\u{1F1F9}', POR: '\u{1F1F5}\u{1F1F9}',
  GRE: '\u{1F1EC}\u{1F1F7}', BUL: '\u{1F1E7}\u{1F1EC}', CRO: '\u{1F1ED}\u{1F1F7}',
  SVK: '\u{1F1F8}\u{1F1F0}', SVN: '\u{1F1F8}\u{1F1EE}', ENG: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
};

export function PlayerProfile({ displayName, roundIds, onClose }: Props) {
  const [resolvedProfile, setResolvedProfile] = useState<{ key: string; status: 'ready' | 'not-found' | 'error' } | null>(null);
  const profileKey = `${displayName}::${roundIds?.join() ?? ''}`;
  const status: Status = resolvedProfile?.key === profileKey ? resolvedProfile.status : 'loading';
  const [broadcastPlayer, setBroadcastPlayer] = useState<BroadcastPlayer | null>(null);
  const [lichessUser, setLichessUser] = useState<LichessUser | null>(null);
  const [tournamentResults, setTournamentResults] = useState<TournamentResult[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const key = `${displayName}::${roundIds?.join() ?? ''}`;
    let cancelled = false;

    async function loadProfile() {
      let bp: BroadcastPlayer | null = null;

      if (roundIds && roundIds.length > 0) {
        for (const rid of roundIds) {
          if (cancelled) return;
          const players = await fetchBroadcastPlayers(rid);
          bp = findBroadcastPlayer(players, displayName);
          if (bp) break;
        }
      }

      if (cancelled) return;

      if (bp) {
        setBroadcastPlayer(bp);
        setResolvedProfile({ key, status: 'ready' });
        fetchLichessUser(displayName.replace(/[\s,]+/g, '').toLowerCase()).then((u) => {
          if (!cancelled && u) {
            setLichessUser(u);
            fetchTournamentResults(u.id).then((r) => { if (!cancelled) setTournamentResults(r); }).catch(() => {});
          }
        }).catch(() => {});
      } else {
        const username = displayName.replace(/[\s,]+/g, '').toLowerCase();
        const u = await fetchLichessUser(username);
        if (cancelled) return;
        if (u) {
          setLichessUser(u);
          setResolvedProfile({ key, status: 'ready' });
          fetchTournamentResults(u.id).then((r) => { if (!cancelled) setTournamentResults(r); }).catch(() => {});
        } else {
          setResolvedProfile({ key, status: 'not-found' });
        }
      }
    }

    loadProfile();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, roundIds?.join()]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        panel!.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    panel.addEventListener('keydown', trapFocus);
    return () => panel.removeEventListener('keydown', trapFocus);
  }, []);

  const readableName = formatPlayerName(displayName);
  const hasBroadcast = broadcastPlayer != null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${readableName} — player profile`}
      className="fixed inset-0 z-[60] flex items-start justify-end sm:p-[16px]"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        className="relative z-10 bg-bg border-l border-line sm:border sm:rounded-[6px] sm:shadow-xl w-full sm:w-[340px] h-full sm:h-auto sm:max-h-[85vh] overflow-y-auto p-[20px] sm:p-[24px] mt-0 sm:mt-[24px]"
      >
        <div className="flex items-start justify-between mb-[16px]">
          <div>
            <p className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase mb-[2px]">
              Player profile
            </p>
            <p className="font-sans text-[16px] font-medium text-ink leading-[1.2]">
              {readableName}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close player profile"
            className="font-sans text-[20px] leading-none text-muted hover:text-ink transition-colors duration-[100ms] p-[8px] -m-[8px] shrink-0 ml-[8px]"
          >
            &times;
          </button>
        </div>

        {status === 'loading' && (
          <div className="py-[32px] flex justify-center">
            <p className="font-mono text-[12px] text-hint tracking-[0.04em] animate-pulse">
              Loading&hellip;
            </p>
          </div>
        )}

        {status === 'not-found' && (
          <p className="font-sans text-[14px] text-muted">
            No profile data available for this player.
          </p>
        )}

        {status === 'error' && (
          <p className="font-sans text-[14px] text-muted">
            Could not load profile.
          </p>
        )}

        {status === 'ready' && (
          <>
            {hasBroadcast && (
              <div className="flex items-center gap-[8px] mb-[20px] flex-wrap">
                {broadcastPlayer.title && (
                  <span className="font-mono text-[11px] font-medium tracking-[0.04em] px-[6px] py-[2px] rounded bg-ink text-bg">
                    {broadcastPlayer.title}
                  </span>
                )}
                {broadcastPlayer.fed && (
                  <span className="font-mono text-[11px] text-muted tracking-[0.04em]">
                    {FLAG_EMOJI[broadcastPlayer.fed] ? `${FLAG_EMOJI[broadcastPlayer.fed]} ` : ''}{broadcastPlayer.fed}
                  </span>
                )}
                {broadcastPlayer.fideId && (
                  <a
                    href={`https://ratings.fide.com/profile/${broadcastPlayer.fideId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] text-muted hover:text-ink underline underline-offset-2 transition-colors"
                  >
                    FIDE profile
                  </a>
                )}
              </div>
            )}

            {hasBroadcast && broadcastPlayer.rating && (
              <div className="mb-[24px]">
                <p className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase mb-[10px]">
                  FIDE Rating
                </p>
                <p className="font-mono text-[28px] font-medium text-ink tabular-nums leading-[1]">
                  {broadcastPlayer.rating}
                </p>
              </div>
            )}

            {lichessUser && (
              <div className="mb-[24px]">
                <div className="flex items-center gap-[8px] mb-[10px]">
                  <p className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase">
                    Lichess Ratings
                  </p>
                  <a
                    href={`https://lichess.org/@/${lichessUser.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] text-muted hover:text-ink underline underline-offset-2 transition-colors"
                  >
                    @{lichessUser.username}
                  </a>
                </div>
                <table className="w-full border-collapse">
                  <tbody>
                    {DISPLAY_VARIANTS.map(({ key, label }) => {
                      const perf = lichessUser.perfs[key];
                      if (!perf || perf.games === 0) return null;
                      return (
                        <tr key={key} className="border-b border-line last:border-0">
                          <td className="py-[7px] font-sans text-[13px] text-muted">{label}</td>
                          <td className="py-[7px] text-right font-mono text-[13px] text-ink tabular-nums">
                            {perf.rating}
                            {perf.prov && (
                              <span className="text-hint ml-[2px]">?</span>
                            )}
                          </td>
                          <td className="py-[7px] text-right font-mono text-[11px] text-hint pl-[8px] tabular-nums w-[48px]">
                            &plusmn;{perf.rd}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!hasBroadcast && lichessUser && (
              <div className="flex items-center gap-[8px] mb-[20px]">
                {lichessUser.title && (
                  <span className="font-mono text-[11px] font-medium tracking-[0.04em] px-[6px] py-[2px] rounded bg-ink text-bg">
                    {lichessUser.title}
                  </span>
                )}
                <a
                  href={`https://lichess.org/@/${lichessUser.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[12px] text-muted hover:text-ink underline underline-offset-2 transition-colors"
                >
                  @{lichessUser.username}
                </a>
              </div>
            )}

            {tournamentResults.length > 0 && (
              <div>
                <p className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase mb-[10px]">
                  Recent Tournaments
                </p>
                <table className="w-full border-collapse">
                  <tbody>
                    {tournamentResults.map((t) => (
                      <tr key={t.id} className="border-b border-line last:border-0">
                        <td className="py-[7px] pr-[8px]">
                          <a
                            href={`https://lichess.org/tournament/${t.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-sans text-[12px] text-ink hover:underline underline-offset-2 line-clamp-1"
                          >
                            {t.fullName}
                          </a>
                          {t.perf && (
                            <span className="font-mono text-[10px] text-hint ml-[0px] block">{t.perf.name}</span>
                          )}
                        </td>
                        <td className="py-[7px] text-right font-mono text-[12px] text-muted tabular-nums whitespace-nowrap pl-[8px] w-[1%]">
                          #{t.rank}
                        </td>
                        <td className="py-[7px] text-right font-mono text-[12px] text-muted tabular-nums whitespace-nowrap pl-[8px] w-[1%]">
                          {t.score}pt{t.score !== 1 ? 's' : ''}
                        </td>
                        <td className="py-[7px] text-right font-mono text-[12px] text-hint tabular-nums whitespace-nowrap pl-[8px] w-[1%]">
                          {t.tourRating ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
