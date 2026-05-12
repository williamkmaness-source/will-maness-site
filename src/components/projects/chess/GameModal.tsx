'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { fetchGamePgn } from './BroadcastService';
import { ChessBoard } from './ChessBoard';
import { ReplayControls } from './ReplayControls';
import type { GameMoveData, SelectedGame } from './types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PIECE_UNICODE: Record<string, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛',
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕',
};

const PIECE_ORDER = ['q', 'r', 'b', 'n', 'p'];

interface Props {
  game: SelectedGame;
  onClose: () => void;
}

type Status = 'loading' | 'ready' | 'error';

// Convert eval (pawns) to a 0–100 white-advantage percentage.
function evalToPercent(e: number): number {
  return Math.round(50 + Math.min(Math.max(e, -5), 5) * 10);
}

// Compute captured pieces by comparing current FEN to the starting piece set.
function computeCaptured(fen: string): { byWhite: string[]; byBlack: string[] } {
  const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, P: 8, N: 2, B: 2, R: 2, Q: 1 };
  const current: Record<string, number> = {};
  for (const ch of fen.split(' ')[0]) {
    if (/[pnbrqPNBRQ]/.test(ch)) current[ch] = (current[ch] ?? 0) + 1;
  }
  const byWhite: string[] = []; // black pieces captured by white
  const byBlack: string[] = []; // white pieces captured by black
  for (const p of PIECE_ORDER) {
    const missing = (start[p] ?? 0) - (current[p] ?? 0);
    for (let i = 0; i < missing; i++) byWhite.push(p);
  }
  for (const p of PIECE_ORDER) {
    const P = p.toUpperCase();
    const missing = (start[P] ?? 0) - (current[P] ?? 0);
    for (let i = 0; i < missing; i++) byBlack.push(P);
  }
  return { byWhite, byBlack };
}

// Material score delta: positive = white up, negative = black up.
const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 };
function materialDelta(byWhite: string[], byBlack: string[]): number {
  return byWhite.reduce((s, p) => s + (PIECE_VALUE[p] ?? 0), 0)
       - byBlack.reduce((s, p) => s + (PIECE_VALUE[p] ?? 0), 0);
}

function CapturedPieces({ pieces, advantage }: { pieces: string[]; advantage: number }) {
  return (
    <div className="flex items-center gap-[2px] min-h-[18px]">
      {pieces.map((p, i) => (
        <span key={i} className="text-[14px] leading-none opacity-70">{PIECE_UNICODE[p]}</span>
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
    ? (evalValue >= 0 ? `+${evalValue.toFixed(1)}` : evalValue.toFixed(1))
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
  const returnFocusRef = useRef<Element | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    return () => { (returnFocusRef.current as HTMLElement | null)?.focus(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setMoveIndex(0);
    fetchGamePgn(game.roundId, game.gameId, controller.signal)
      .then((m) => { setMoves(m); setStatus('ready'); })
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

  const goFirst = useCallback(() => setMoveIndex(0), []);
  const goPrev  = useCallback(() => setMoveIndex((i) => Math.max(0, i - 1)), []);
  const goNext  = useCallback(() => setMoveIndex((i) => Math.min(moves.length, i + 1)), [moves.length]);
  const goLast  = useCallback(() => setMoveIndex(moves.length), [moves.length]);

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

  const { byWhite, byBlack } = useMemo(() => computeCaptured(fen), [fen]);
  const delta = materialDelta(byWhite, byBlack);

  return (
    <div
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
            className="font-sans text-[20px] leading-none text-muted hover:text-ink transition-colors duration-[100ms]"
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
