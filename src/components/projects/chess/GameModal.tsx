'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { fetchGamePgn, fetchGamePgnLive, DEFAULT_INTERVAL } from './BroadcastService';
import { ChessBoard } from './ChessBoard';
import { ReplayControls } from './ReplayControls';
import { playPieceSound } from '@/lib/playPieceSound';
import type { GameMoveData, SelectedGame } from './types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PIECE_ORDER = ['q', 'r', 'b', 'n', 'p'];

// Inline SVG piece icons — consistent rendering across all platforms (no font dependency)
function PieceIcon({ piece }: { piece: string }) {
  const type = piece.toLowerCase() as 'p' | 'n' | 'b' | 'r' | 'q';
  const isLight = piece !== type;
  const fill = isLight ? '#e8d5b7' : '#4a3a28';
  const stroke = isLight ? '#7a6040' : '#c8a870';
  const sw = 0.8;
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {type === 'p' && (<>
        <circle cx="8" cy="4" r="2.5" fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d="M5.5 6.5C5 9 4.5 10.5 4 12h8c-.5-1.5-1-3-1.5-5.5z" fill={fill} stroke={stroke} strokeWidth={sw} />
        <rect x="2.5" y="12" width="11" height="2.5" rx="0.5" fill={fill} stroke={stroke} strokeWidth={sw} />
      </>)}
      {type === 'n' && (
        <path d="M5 14V9c0-3 1-4 2-5 .5-.5 1-1 2-1s2 .5 2 2c0 1-1 1.5-1 2v1h1l1 1-1 2h-1l-.5 3z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      )}
      {type === 'b' && (<>
        <circle cx="8" cy="3.5" r="2" fill={fill} stroke={stroke} strokeWidth={sw} />
        <circle cx="8" cy="3.5" r="0.6" fill={stroke} />
        <path d="M6.5 5.5L5 12h6L9.5 5.5z" fill={fill} stroke={stroke} strokeWidth={sw} />
        <rect x="2.5" y="12" width="11" height="2.5" rx="0.5" fill={fill} stroke={stroke} strokeWidth={sw} />
      </>)}
      {type === 'r' && (<>
        <rect x="3" y="2" width="2" height="3.5" fill={fill} stroke={stroke} strokeWidth={sw} />
        <rect x="7" y="2" width="2" height="3.5" fill={fill} stroke={stroke} strokeWidth={sw} />
        <rect x="11" y="2" width="2" height="3.5" fill={fill} stroke={stroke} strokeWidth={sw} />
        <rect x="3" y="4.5" width="10" height="7" fill={fill} stroke={stroke} strokeWidth={sw} />
        <rect x="2" y="12" width="12" height="2.5" rx="0.5" fill={fill} stroke={stroke} strokeWidth={sw} />
      </>)}
      {type === 'q' && (<>
        <circle cx="8" cy="3" r="1.5" fill={fill} stroke={stroke} strokeWidth={sw} />
        <circle cx="3.5" cy="4.5" r="1.2" fill={fill} stroke={stroke} strokeWidth={sw} />
        <circle cx="12.5" cy="4.5" r="1.2" fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d="M2.5 6l1.5 5h8l1.5-5-3 2.5L8 5l-2.5 3.5z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <rect x="2.5" y="11.5" width="11" height="2.5" rx="0.5" fill={fill} stroke={stroke} strokeWidth={sw} />
      </>)}
    </svg>
  );
}

interface Props {
  game: SelectedGame;
  onClose: () => void;
}

type Status = 'loading' | 'ready' | 'error';

// Convert eval (pawns, or ±Infinity for mate) to a 0–100 white-advantage percentage.
function evalToPercent(e: number): number {
  if (!isFinite(e)) return e > 0 ? 100 : 0;
  return Math.round(50 + Math.min(Math.max(e, -5), 5) * 10);
}

// Walk the move history to collect captured pieces — correct under promotions
// (FEN diffing would mis-classify a promoted pawn as captured).
function computeCaptured(
  moves: GameMoveData[],
  moveIndex: number,
): { byWhite: string[]; byBlack: string[] } {
  const byWhite: string[] = []; // black pieces captured by white (lowercase)
  const byBlack: string[] = []; // white pieces captured by black (uppercase)
  for (let i = 0; i < moveIndex; i++) {
    const captured = moves[i]?.captured;
    if (!captured) continue;
    if (i % 2 === 0) byWhite.push(captured.toLowerCase());
    else byBlack.push(captured.toUpperCase());
  }
  const sortFn = (a: string, b: string) =>
    PIECE_ORDER.indexOf(a.toLowerCase()) - PIECE_ORDER.indexOf(b.toLowerCase());
  return { byWhite: byWhite.sort(sortFn), byBlack: byBlack.sort(sortFn) };
}

// Material score delta: positive = white up, negative = black up.
const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 };
function materialDelta(byWhite: string[], byBlack: string[]): number {
  return byWhite.reduce((s, p) => s + (PIECE_VALUE[p] ?? 0), 0)
       - byBlack.reduce((s, p) => s + (PIECE_VALUE[p] ?? 0), 0);
}

function CapturedPieces({ pieces, advantage }: { pieces: string[]; advantage: number }) {
  return (
    <div className="flex items-center gap-[1px] min-h-[16px]">
      {pieces.map((p, i) => (
        <span key={i} className="inline-block w-[16px] h-[16px] opacity-70 shrink-0">
          <PieceIcon piece={p} />
        </span>
      ))}
      {advantage > 0 && (
        <span className="font-sans text-[11px] text-muted ml-[4px]">+{advantage}</span>
      )}
    </div>
  );
}

function EvalBar({ evalValue }: { evalValue: number | null }) {
  const pct = evalValue !== null ? evalToPercent(evalValue) : 50;
  const label = evalValue !== null
    ? !isFinite(evalValue)
      ? (evalValue > 0 ? 'M+' : 'M−')
      : (evalValue >= 0 ? `+${evalValue.toFixed(1)}` : evalValue.toFixed(1))
    : null;

  return (
    <div className="flex items-center gap-[8px] my-[8px]">
      <div className="flex-1 h-[6px] rounded-full overflow-hidden bg-ink/20">
        <div
          className="h-full bg-ink rounded-full transition-all duration-[300ms]"
          style={{ width: `${pct}%` }}
        />
      </div>
      {label && (
        <span className="font-mono text-[11px] text-muted w-[36px] text-right tabular-nums shrink-0">
          {label}
        </span>
      )}
    </div>
  );
}

function MoveList({
  moves,
  moveIndex,
  onSelect,
}: {
  moves: GameMoveData[];
  moveIndex: number;
  onSelect: (index: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = activeRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const { offsetTop, offsetHeight } = el;
    const { scrollTop, clientHeight } = container;
    if (offsetTop < scrollTop) {
      container.scrollTop = offsetTop;
    } else if (offsetTop + offsetHeight > scrollTop + clientHeight) {
      container.scrollTop = offsetTop + offsetHeight - clientHeight;
    }
  }, [moveIndex]);

  const pairs: Array<[number, GameMoveData, GameMoveData | null]> = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([i, moves[i], moves[i + 1] ?? null]);
  }

  return (
    <div ref={containerRef} className="mt-[12px] overflow-y-auto max-h-[220px] border-t border-line pt-[8px]">
      <table className="w-full border-collapse">
        <tbody>
          {pairs.map(([i, white, black]) => {
            const moveNum = Math.floor(i / 2) + 1;
            const whiteActive = moveIndex === i + 1;
            const blackActive = moveIndex === i + 2;
            return (
              <tr key={i} className="hover:bg-bg-soft">
                <td className="font-mono text-[11px] text-muted py-[3px] pr-[8px] w-[28px] select-none">
                  {moveNum}.
                </td>
                <td className="py-[3px] pr-[4px] w-1/2">
                  <button
                    ref={whiteActive ? activeRef : null}
                    onClick={() => onSelect(i + 1)}
                    className={[
                      'font-mono text-[13px] w-full text-left px-[6px] py-[2px] rounded transition-colors duration-[80ms]',
                      whiteActive ? 'bg-ink text-bg' : 'text-ink hover:bg-bg-soft',
                    ].join(' ')}
                  >
                    {white.san}
                  </button>
                </td>
                <td className="py-[3px] w-1/2">
                  {black && (
                    <button
                      ref={blackActive ? activeRef : null}
                      onClick={() => onSelect(i + 2)}
                      className={[
                        'font-mono text-[13px] w-full text-left px-[6px] py-[2px] rounded transition-colors duration-[80ms]',
                        blackActive ? 'bg-ink text-bg' : 'text-ink hover:bg-bg-soft',
                      ].join(' ')}
                    >
                      {black.san}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GameModal({ game, onClose }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [moves, setMoves] = useState<GameMoveData[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [newMoveCount, setNewMoveCount] = useState(0);
  const returnFocusRef = useRef<Element | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const movesLenRef = useRef(0);
  const prevMoveIndexRef = useRef(0);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    return () => { (returnFocusRef.current as HTMLElement | null)?.focus(); };
  }, []);

  useEffect(() => {
    if (moveIndex > prevMoveIndexRef.current) {
      playPieceSound();
    }
    prevMoveIndexRef.current = moveIndex;
  }, [moveIndex]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setMoveIndex(0);
    setNewMoveCount(0);
    fetchGamePgn(game.roundId, game.gameId, controller.signal)
      .then((m) => { movesLenRef.current = m.length; setMoves(m); setStatus('ready'); })
      .catch((err) => { if ((err as Error).name !== 'AbortError') setStatus('error'); });
    return () => controller.abort();
  }, [game.roundId, game.gameId, retryCount]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        dialog!.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
    dialog.addEventListener('keydown', trapFocus);
    return () => dialog.removeEventListener('keydown', trapFocus);
  }, []);

  useEffect(() => {
    if (!game.isLive || status !== 'ready') return;

    let aborted = false;
    const controller = new AbortController();
    let timerId: ReturnType<typeof setTimeout>;

    async function runPoll() {
      if (aborted) return;
      try {
        const { moves: newMoves, isComplete, pollingInterval } = await fetchGamePgnLive(
          game.roundId, game.gameId, controller.signal,
        );
        if (aborted) return;
        const prevLen = movesLenRef.current;
        movesLenRef.current = newMoves.length;
        if (newMoves.length > prevLen) {
          setNewMoveCount((n) => n + (newMoves.length - prevLen));
          setMoves(newMoves);
        }
        if (!isComplete) timerId = setTimeout(runPoll, pollingInterval);
      } catch (err) {
        if (!aborted && (err as Error).name !== 'AbortError') {
          timerId = setTimeout(runPoll, DEFAULT_INTERVAL);
        }
      }
    }

    timerId = setTimeout(runPoll, DEFAULT_INTERVAL);
    return () => { aborted = true; controller.abort(); clearTimeout(timerId); };
  }, [game.isLive, game.roundId, game.gameId, status]);

  const goFirst = useCallback(() => setMoveIndex(0), []);
  const goPrev  = useCallback(() => setMoveIndex((i) => Math.max(0, i - 1)), []);
  const goNext  = useCallback(() => setMoveIndex((i) => Math.min(moves.length, i + 1)), [moves.length]);
  const goLast  = useCallback(() => setMoveIndex(moves.length), [moves.length]);
  const jumpToLatest = useCallback(() => { setMoveIndex(moves.length); setNewMoveCount(0); }, [moves.length]);

  const fen = moveIndex === 0 ? START_FEN : (moves[moveIndex - 1]?.fen ?? START_FEN);

  const currentEval = moveIndex > 0 ? (moves[moveIndex - 1]?.eval ?? null) : null;

  // Clocks: find last known reading for each side up to current position.
  const { whiteClock, blackClock } = useMemo(() => {
    let w: string | null = null;
    let b: string | null = null;
    for (let i = 0; i < moveIndex; i++) {
      if (i % 2 === 0) w = moves[i]?.clock ?? w;
      else             b = moves[i]?.clock ?? b;
    }
    return { whiteClock: w, blackClock: b };
  }, [moves, moveIndex]);

  const { byWhite, byBlack } = useMemo(() => computeCaptured(moves, moveIndex), [moves, moveIndex]);
  const delta = materialDelta(byWhite, byBlack);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${game.white} vs ${game.black}`}
      className="fixed inset-0 z-50 flex items-center justify-center sm:p-[16px]"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 bg-bg sm:rounded-[6px] border-0 sm:border border-line sm:shadow-xl w-full sm:max-w-[480px] h-full sm:h-auto overflow-y-auto p-[20px] sm:p-[24px]">
        {/* Header */}
        <div className="flex items-start justify-between mb-[12px]">
          <p className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase">
            Game replay
          </p>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close game replay"
            className="font-sans text-[20px] leading-none text-muted hover:text-ink transition-colors duration-[100ms] p-[8px] -m-[8px]"
          >
            ×
          </button>
        </div>

        {status === 'loading' && (
          <div className="flex items-center justify-center h-[200px]">
            <p className="font-mono text-[12px] text-muted tracking-[0.04em] uppercase animate-pulse">
              Loading…
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center gap-[12px] h-[200px]">
            <p className="font-sans text-[14px] text-muted">Could not load game.</p>
            <button
              onClick={() => setRetryCount((n) => n + 1)}
              className="font-sans text-[13px] font-medium text-ink border border-line-strong px-[16px] py-[7px] rounded hover:bg-bg-soft transition-colors duration-[120ms]"
            >
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* Black player row */}
            <div className="flex items-center justify-between mb-[4px]">
              <div>
                <p className="font-sans text-[14px] font-medium text-ink">{game.black}</p>
                <CapturedPieces pieces={byBlack} advantage={delta < 0 ? -delta : 0} />
              </div>
              {blackClock && (
                <span className="font-mono text-[13px] text-muted tabular-nums">{blackClock}</span>
              )}
            </div>

            {/* Board */}
            <ChessBoard fen={fen} />

            {/* White player row */}
            <div className="flex items-center justify-between mt-[4px]">
              <div>
                <CapturedPieces pieces={byWhite} advantage={delta > 0 ? delta : 0} />
                <p className="font-sans text-[14px] font-medium text-ink mt-[2px]">{game.white}</p>
              </div>
              {whiteClock && (
                <span className="font-mono text-[13px] text-muted tabular-nums">{whiteClock}</span>
              )}
            </div>

            <EvalBar evalValue={currentEval} />

            {game.isLive && newMoveCount > 0 && (
              <button
                onClick={jumpToLatest}
                className="w-full flex items-center justify-center gap-[6px] font-mono text-[11px] tracking-[0.04em] uppercase text-ink bg-bg-soft border border-line rounded py-[5px] mb-[6px] hover:bg-line transition-colors duration-[100ms]"
              >
                <span className="w-[6px] h-[6px] rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                {newMoveCount} new {newMoveCount === 1 ? 'move' : 'moves'} — Jump to latest
              </button>
            )}

            <ReplayControls
              moveIndex={moveIndex}
              totalMoves={moves.length}
              onFirst={goFirst}
              onPrev={goPrev}
              onNext={goNext}
              onLast={goLast}
            />

            <MoveList moves={moves} moveIndex={moveIndex} onSelect={setMoveIndex} />
          </>
        )}
      </div>
    </div>
  );
}
