'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import { fetchGamePgn } from './BroadcastService';
import { ChessBoard } from './ChessBoard';
import { ReplayControls } from './ReplayControls';
import type { SelectedGame } from './types';

interface Props {
  game: SelectedGame;
  onClose: () => void;
}

type Status = 'loading' | 'ready' | 'error';

function fenAtIndex(moves: string[], index: number): string {
  const chess = new Chess();
  for (let i = 0; i < index; i++) chess.move(moves[i]);
  return chess.fen();
}

export function GameModal({ game, onClose }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [moves, setMoves] = useState<string[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  // Restore focus to the element that was active when the modal opened.
  const returnFocusRef = useRef<Element | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    return () => {
      (returnFocusRef.current as HTMLElement | null)?.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setMoveIndex(0);

    fetchGamePgn(game.roundId, game.gameId, controller.signal)
      .then((m) => { setMoves(m); setStatus('ready'); })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setStatus('error');
      });

    return () => controller.abort();
  }, [game.roundId, game.gameId, retryCount]);

  // Close on Escape.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const goFirst = useCallback(() => setMoveIndex(0), []);
  const goPrev = useCallback(() => setMoveIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setMoveIndex((i) => Math.min(moves.length, i + 1)), [moves.length]);
  const goLast = useCallback(() => setMoveIndex(moves.length), [moves.length]);

  const fen = status === 'ready' ? fenAtIndex(moves, moveIndex) : 'start';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${game.white} vs ${game.black}`}
      className="fixed inset-0 z-50 flex items-center justify-center sm:p-[16px]"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 bg-bg sm:rounded-[6px] border-0 sm:border border-line sm:shadow-xl w-full sm:max-w-[480px] h-full sm:h-auto overflow-y-auto p-[20px] sm:p-[24px]">
        {/* Header */}
        <div className="flex items-start justify-between mb-[16px]">
          <div>
            <p className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase mb-[4px]">
              Game replay
            </p>
            <p className="font-sans text-[16px] font-medium text-ink leading-[1.3]">
              {game.white} <span className="text-muted font-normal">vs</span> {game.black}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close game replay"
            className="ml-[16px] mt-[2px] font-sans text-[20px] leading-none text-muted hover:text-ink transition-colors duration-[100ms]"
          >
            ×
          </button>
        </div>

        {/* Body */}
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
            <ChessBoard fen={fen} />
            <ReplayControls
              moveIndex={moveIndex}
              totalMoves={moves.length}
              onFirst={goFirst}
              onPrev={goPrev}
              onNext={goNext}
              onLast={goLast}
            />
          </>
        )}
      </div>
    </div>
  );
}
