'use client';

import { Chessboard } from 'react-chessboard';

interface Props {
  fen: string;
}

export function ChessBoard({ fen }: Props) {
  return (
    <div className="w-full aspect-square">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: 'white',
          allowDragging: false,
          animationDurationInMs: 150,
          boardStyle: { borderRadius: 4 },
        }}
      />
    </div>
  );
}
