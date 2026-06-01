'use client';

import { useEffect, useRef, useState } from 'react';

// Lichess user API response shapes (partial — only what we display).
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

// Lichess tournament/results NDJSON line shape.
type TournamentResult = {
  rank?: number;
  score?: number;
  perf?: { glicko?: { rating?: number } };
  tournament?: { id?: string; fullName?: string; slug?: string };
};

const DISPLAY_VARIANTS: Array<{ key: keyof LichessUser['perfs']; label: string }> = [
  { key: 'classical', label: 'Classical' },
  { key: 'rapid', label: 'Rapid' },
  { key: 'blitz', label: 'Blitz' },
  { key: 'bullet', label: 'Bullet' },
];

// Module-level session cache to avoid redundant API calls for the same player.
const userCache = new Map<string, LichessUser | null>();
const resultsCache = new Map<string, TournamentResult[]>();

async function fetchUser(username: string): Promise<LichessUser | null> {
  const key = username.toLowerCase();
  if (userCache.has(key)) return userCache.get(key)!;

  try {
    const res = await fetch(`https://lichess.org/api/user/${encodeURIComponent(key)}`);
    if (!res.ok) { userCache.set(key, null); return null; }
    const data = (await res.json()) as LichessUser;
    userCache.set(key, data);
    return data;
  } catch {
    userCache.set(key, null);
    return null;
  }
}

async function fetchResults(username: string): Promise<TournamentResult[]> {
  const key = username.toLowerCase();
  if (resultsCache.has(key)) return resultsCache.get(key)!;

  try {
    const res = await fetch(
      `https://lichess.org/api/user/${encodeURIComponent(key)}/tournament/results?nb=10`,
    );
    if (!res.ok) { resultsCache.set(key, []); return []; }
    const text = await res.text();
    const rows = text.split('\n').filter(Boolean).map((l) => {
      try { return JSON.parse(l) as TournamentResult; } catch { return null; }
    }).filter((r): r is TournamentResult => r !== null);
    resultsCache.set(key, rows);
    return rows;
  } catch {
    resultsCache.set(key, []);
    return [];
  }
}

// Derive a Lichess username from the display name shown in the broadcast.
// Broadcasts use either the real Lichess username or the player's real name.
// We try the raw string (spaces stripped) and fall back to just the name as-is.
function deriveLichessUsername(displayName: string): string {
  return displayName.replace(/\s+/g, '').toLowerCase();
}

interface Props {
  displayName: string;
  onClose: () => void;
}

type Status = 'loading' | 'ready' | 'not-found' | 'error';

export function PlayerProfile({ displayName, onClose }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<LichessUser | null>(null);
  const [results, setResults] = useState<TournamentResult[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const username = deriveLichessUsername(displayName);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    setStatus('loading');
    let cancelled = false;

    Promise.all([fetchUser(username), fetchResults(username)]).then(([u, r]) => {
      if (cancelled) return;
      if (u === null) { setStatus('not-found'); return; }
      setUser(u);
      setResults(r);
      setStatus('ready');
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => { cancelled = true; };
  }, [username]);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${displayName} — Lichess profile`}
      className="fixed inset-0 z-[60] flex items-start justify-end sm:p-[16px]"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        className="relative z-10 bg-bg border-l border-line sm:border sm:rounded-[6px] sm:shadow-xl w-full sm:w-[340px] h-full sm:h-auto sm:max-h-[85vh] overflow-y-auto p-[20px] sm:p-[24px] mt-0 sm:mt-[24px]"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-[16px]">
          <div>
            <p className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase mb-[2px]">
              Lichess profile
            </p>
            <p className="font-sans text-[16px] font-medium text-ink leading-[1.2]">
              {displayName}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close player profile"
            className="font-sans text-[20px] leading-none text-muted hover:text-ink transition-colors duration-[100ms] p-[8px] -m-[8px] shrink-0 ml-[8px]"
          >
            ×
          </button>
        </div>

        {status === 'loading' && (
          <div className="py-[32px] flex justify-center">
            <p className="font-mono text-[12px] text-hint tracking-[0.04em] animate-pulse">
              Loading…
            </p>
          </div>
        )}

        {status === 'not-found' && (
          <p className="font-sans text-[14px] text-muted">
            Profile not found on Lichess for{' '}
            <span className="font-mono">{username}</span>.
          </p>
        )}

        {status === 'error' && (
          <p className="font-sans text-[14px] text-muted">
            Could not load profile.
          </p>
        )}

        {status === 'ready' && user && (
          <>
            {/* Title badge + username */}
            <div className="flex items-center gap-[8px] mb-[20px]">
              {user.title && (
                <span className="font-mono text-[11px] font-medium tracking-[0.04em] px-[6px] py-[2px] rounded bg-ink text-bg">
                  {user.title}
                </span>
              )}
              <a
                href={`https://lichess.org/@/${user.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[12px] text-muted hover:text-ink underline underline-offset-2 transition-colors"
              >
                @{user.username}
              </a>
            </div>

            {/* Ratings */}
            <div className="mb-[24px]">
              <p className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase mb-[10px]">
                Ratings
              </p>
              <table className="w-full border-collapse">
                <tbody>
                  {DISPLAY_VARIANTS.map(({ key, label }) => {
                    const perf = user.perfs[key];
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
                          ±{perf.rd}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Recent tournament results */}
            {results.length > 0 && (
              <div>
                <p className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase mb-[10px]">
                  Recent tournaments
                </p>
                <div className="flex flex-col gap-[10px]">
                  {results.map((r, i) => {
                    const name = r.tournament?.fullName ?? 'Unknown tournament';
                    const slug = r.tournament?.slug;
                    const id = r.tournament?.id;
                    const perfRating = r.perf?.glicko?.rating;
                    const href = slug ? `https://lichess.org/tournament/${slug}` : id ? `https://lichess.org/tournament/${id}` : null;

                    return (
                      <div key={i} className="border-b border-line last:border-0 pb-[10px] last:pb-0">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-sans text-[13px] text-ink font-medium hover:underline underline-offset-2 leading-[1.3] block"
                          >
                            {name}
                          </a>
                        ) : (
                          <p className="font-sans text-[13px] text-ink font-medium leading-[1.3]">{name}</p>
                        )}
                        <div className="flex items-center gap-[12px] mt-[3px] font-mono text-[11px] text-muted">
                          {r.rank != null && <span>#{r.rank}</span>}
                          {r.score != null && <span>{r.score}pts</span>}
                          {perfRating != null && <span>Perf {perfRating}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {results.length === 0 && (
              <p className="font-sans text-[13px] text-muted">No recent tournament results.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
