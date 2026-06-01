'use client';

import { Chessboard } from 'react-chessboard';
import type { MoveQuality } from '@/lib/chess/moveQuality';
import { QUALITY_COLORS } from '@/lib/chess/moveQuality';

export interface QualityDot {
  quality: MoveQuality;
  square: string; // e.g. 'e4' — the landing square of the most recent move
  isLoading?: boolean;
}

interface Props {
  fen: string;
  qualityDot?: QualityDot | null;
}

export function ChessBoard({ fen, qualityDot }: Props) {
  return (
    <div className="w-full aspect-square">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: 'white',
          allowDragging: false,
          animationDurationInMs: 150,
          boardStyle: { borderRadius: 4 },
          squareRenderer: qualityDot
            ? ({ square, children }) => (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  {children}
                  {square === qualityDot.square && (
                    <div
                      aria-label={qualityDot.quality}
                      style={{
                        position: 'absolute',
                        bottom: '3px',
                        right: '3px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: QUALITY_COLORS[qualityDot.quality],
                        border: '1.5px solid rgba(255,255,255,0.6)',
                        zIndex: 10,
                        animation: qualityDot.isLoading ? undefined : 'none',
                        opacity: qualityDot.isLoading ? 0.5 : 1,
                      }}
                    />
                  )}
                </div>
              )
            : undefined,
        }}
      />
    </div>
  );
}
