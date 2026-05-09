'use client';

// ViennaTrainer — the heavy interactive component loaded only in the browser.
// Depends on chess.js and react-chessboard; never server-rendered.

import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useReducer, useMemo, useState, useRef, useEffect } from 'react';
import { trainerReducer, initialState } from './reducer';
import { BlackNode, TheoryNode, WhiteNode } from './types';
import theoryTree from '../../../../content/projects/vienna-trainer/theory.json';

// react-chessboard does not re-export handler types from its package root — inline them.
type PieceDropHandlerArgs = { piece: unknown; sourceSquare: string; targetSquare: string | null };
type SquareHandlerArgs = { piece: { pieceType: string } | null; square: string };

const ROOT = theoryTree as unknown as WhiteNode;
const BLACK_RESPONSE_DELAY_MS = 500;

export function ViennaTrainer() {
  const [state, dispatch] = useReducer(trainerReducer, initialState(ROOT));
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [moveInputError, setMoveInputError] = useState(false);
  const moveInputRef = useRef<HTMLInputElement>(null);

  // Replay moveHistory to get the current board FEN.
  const fen = useMemo(() => {
    const chess = new Chess();
    for (const san of state.moveHistory) chess.move(san);
    return chess.fen();
  }, [state.moveHistory]);

  // Walk the tree via moveHistory to find the last non-null variation name.
  const currentVariation = useMemo(() => {
    let node: TheoryNode = ROOT;
    let variation: string | null = null;
    for (const san of state.moveHistory) {
      if (node.turn === 'w') {
        const w = node as WhiteNode;
        if (w.variation) variation = w.variation;
        if (!w.next) break;
        node = w.next;
      } else {
        const b = node as BlackNode;
        const r = b.responses.find((resp) => resp.san === san);
        if (!r?.next) break;
        node = r.next;
      }
    }
    if (node?.turn === 'w' && (node as WhiteNode).variation) {
      variation = (node as WhiteNode).variation;
    }
    return variation;
  }, [state.moveHistory]);

  useEffect(() => {
    if (state.phase !== 'awaiting_black') return;
    const id = setTimeout(() => dispatch({ type: 'APPLY_BLACK' }), BLACK_RESPONSE_DELAY_MS);
    return () => clearTimeout(id);
  }, [state.phase]);

  const isWhiteTurn = state.currentNode.turn === 'w' && state.phase === 'playing';

  // ── Status banner ────────────────────────────────────────────────────────────

  let statusText: string;
  let statusColor: string;
  if (state.phase === 'complete') {
    statusText = currentVariation
      ? `Well played — you've completed ${currentVariation}!`
      : 'Variation complete — well played!';
    statusColor = 'var(--accent)';
  } else if (state.wrongAttempts > 0) {
    statusText = 'Not the mainline — try again';
    statusColor = 'var(--clay)';
  } else {
    statusText = 'Your move';
    statusColor = 'var(--muted)';
  }

  // ── Square highlight styles ──────────────────────────────────────────────────

  const squareStyles: Record<string, React.CSSProperties> = {};

  if (selectedSquare) {
    squareStyles[selectedSquare] = {
      backgroundColor: 'rgba(255, 214, 0, 0.45)',
      borderRadius: 2,
    };
  }

  if (isWhiteTurn && state.hintLevel >= 1) {
    const node = state.currentNode as WhiteNode;
    squareStyles[node.move.from] = {
      backgroundColor: 'rgba(255, 160, 40, 0.55)',
      borderRadius: 2,
    };
  }

  if (isWhiteTurn && state.hintLevel >= 2) {
    const node = state.currentNode as WhiteNode;
    squareStyles[node.move.to] = {
      backgroundColor: 'rgba(255, 100, 30, 0.45)',
      borderRadius: 2,
    };
  }

  // ── Move list ────────────────────────────────────────────────────────────────

  const moveListText = useMemo(() => {
    const pairs: string[] = [];
    for (let i = 0; i < state.moveHistory.length; i += 2) {
      const n = Math.floor(i / 2) + 1;
      const white = state.moveHistory[i];
      const black = state.moveHistory[i + 1];
      pairs.push(`${n}. ${white}${black ? ` ${black}` : ''}`);
    }
    return pairs.join('   ');
  }, [state.moveHistory]);

  // ── Keyboard / typed move input ──────────────────────────────────────────────
  // Accepts SAN ("e4", "Nc3") or coordinate notation ("e2e4", "b1-c3").
  // Provides keyboard and screen-reader access without requiring 64 focusable squares.

  function handleMoveInput(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isWhiteTurn) return;

    const raw = moveInputRef.current?.value.trim() ?? '';
    if (!raw) return;

    // Build a chess instance at the current position to resolve the input.
    const chess = new Chess();
    for (const san of state.moveHistory) chess.move(san);

    let from = '';
    let to = '';

    // Try SAN first ("e4", "Nc3", "O-O").
    try {
      const move = chess.move(raw);
      from = move.from;
      to = move.to;
    } catch {
      // Try coordinate notation: "e2e4" or "e2-e4".
      const coord = raw.replace('-', '').match(/^([a-h][1-8])([a-h][1-8])$/i);
      if (coord) {
        try {
          const move = chess.move({ from: coord[1].toLowerCase(), to: coord[2].toLowerCase() });
          from = move.from;
          to = move.to;
        } catch {
          // Fall through — invalid.
        }
      }
    }

    if (!from) {
      setMoveInputError(true);
      setTimeout(() => setMoveInputError(false), 1200);
      return;
    }

    if (moveInputRef.current) moveInputRef.current.value = '';
    setMoveInputError(false);
    dispatch({ type: 'MOVE', from, to });
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────────

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare || !isWhiteTurn) return false;
    const node = state.currentNode as WhiteNode;
    const correct = sourceSquare === node.move.from && targetSquare === node.move.to;
    dispatch({ type: 'MOVE', from: sourceSquare, to: targetSquare });
    return correct;
  }

  // ── Click-to-move ────────────────────────────────────────────────────────────

  function handleSquareClick({ piece, square }: SquareHandlerArgs): void {
    if (!isWhiteTurn) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }
      dispatch({ type: 'MOVE', from: selectedSquare, to: square });
      setSelectedSquare(null);
      return;
    }

    if (piece && piece.pieceType[0] === 'w') {
      setSelectedSquare(square);
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────────

  function handleReset() {
    setSelectedSquare(null);
    setMoveInputError(false);
    if (moveInputRef.current) moveInputRef.current.value = '';
    dispatch({ type: 'RESET', rootNode: ROOT });
  }

  // ── Shared button style ───────────────────────────────────────────────────────

  const btnStyle: React.CSSProperties = {
    fontFamily: 'var(--font-sans, sans-serif)',
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: '0.03em',
    padding: '7px 16px',
    border: '1px solid var(--line-strong)',
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: 'var(--ink)',
    cursor: 'pointer',
    transition: 'background-color 120ms',
  };

  function onBtnEnter(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.backgroundColor = 'var(--bg-soft)';
  }
  function onBtnLeave(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.backgroundColor = 'transparent';
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      style={{ maxWidth: 480, width: '100%' }}
      aria-label="Vienna Opening chess trainer"
    >
      <Chessboard
        options={{
          position: fen,
          boardOrientation: 'white',
          onPieceDrop: handleDrop,
          onSquareClick: handleSquareClick,
          squareStyles,
          allowDragging: isWhiteTurn,
          animationDurationInMs: 200,
          boardStyle: { borderRadius: 4 },
        }}
      />

      {/* Status banner — aria-live so screen readers announce state changes */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          fontFamily: 'var(--font-sans, sans-serif)',
          fontSize: 13,
          fontWeight: 500,
          color: statusColor,
          marginTop: 14,
          marginBottom: 0,
          minHeight: 20,
          letterSpacing: '0.01em',
          transition: 'color 120ms',
        }}
      >
        {statusText}
      </p>

      {/* Controls row */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={handleReset}
          aria-label="Reset trainer to move 1"
          style={btnStyle}
          onMouseEnter={onBtnEnter}
          onMouseLeave={onBtnLeave}
        >
          Reset
        </button>

        {currentVariation && (
          <span
            aria-label={`Current variation: ${currentVariation}`}
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
            }}
          >
            {currentVariation}
          </span>
        )}
      </div>

      {/* Keyboard / accessibility move input — visible on the user's turn */}
      {isWhiteTurn && (
        <form
          onSubmit={handleMoveInput}
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
          aria-label="Enter your move"
        >
          <label
            htmlFor="vienna-move-input"
            style={{
              fontFamily: 'var(--font-sans, sans-serif)',
              fontSize: 12,
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
            }}
          >
            Keyboard move:
          </label>
          <input
            id="vienna-move-input"
            ref={moveInputRef}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. e4 or e2e4"
            aria-label="Enter move in algebraic notation"
            aria-invalid={moveInputError}
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 13,
              padding: '5px 10px',
              border: `1px solid ${moveInputError ? 'var(--clay)' : 'var(--line-strong)'}`,
              borderRadius: 4,
              backgroundColor: 'transparent',
              color: 'var(--ink)',
              width: 120,
              outline: 'none',
              transition: 'border-color 120ms',
            }}
          />
          <button
            type="submit"
            style={btnStyle}
            onMouseEnter={onBtnEnter}
            onMouseLeave={onBtnLeave}
          >
            Move
          </button>
        </form>
      )}

      {/* Move list — aria-live so screen readers announce each new ply */}
      {moveListText && (
        <p
          role="log"
          aria-label="Move history"
          aria-live="polite"
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 12,
            color: 'var(--hint)',
            marginTop: 12,
            marginBottom: 0,
            lineHeight: 1.6,
            letterSpacing: '0.02em',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
          }}
        >
          {moveListText}
        </p>
      )}
    </div>
  );
}
