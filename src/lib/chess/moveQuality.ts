import { Chess } from 'chess.js';
import type { CloudEvalResult } from './cloudEval';

export type MoveQuality = 'Brilliant' | 'Excellent' | 'Good' | 'Mistake' | 'Miss';

const BRILLIANT_MAX_CP_LOSS = 15;
const EXCELLENT_MAX_CP_LOSS = 10;
const GOOD_MAX_CP_LOSS = 25;
const MISTAKE_MAX_CP_LOSS = 100;

export const QUALITY_COLORS: Record<MoveQuality, string> = {
  Brilliant: '#20a0a0',
  Excellent: '#5a9c5a',
  Good: '#8fc88a',
  Mistake: '#d97b2e',
  Miss: '#c44040',
};

function sanToUci(fen: string, san: string): string | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move(san);
    return move.from + move.to + (move.promotion ?? '');
  } catch {
    return null;
  }
}

function isMaterialSacrifice(
  fenAfterMove: string,
  landingSquare: string,
  movedBy: 'w' | 'b',
): boolean {
  try {
    const chess = new Chess(fenAfterMove);
    const opponent = movedBy === 'w' ? 'b' : 'w';
    return chess.isAttacked(
      landingSquare as Parameters<typeof chess.isAttacked>[0],
      opponent,
    );
  } catch {
    return false;
  }
}

export interface ClassifyParams {
  cloud: CloudEvalResult;
  fenBefore: string;
  fenAfter: string;
  san: string;
  // moveIndex is 1-based: odd = white to move, even = black to move
  moveIndex: number;
  // PGN eval after the move, in pawns (absolute: positive = white better); null if unavailable
  pgnEvalAfter: number | null;
}

export function classifyMove({
  cloud,
  fenBefore,
  fenAfter,
  san,
  moveIndex,
  pgnEvalAfter,
}: ClassifyParams): MoveQuality | null {
  if (!cloud.pvs.length) return null;

  const topPv = cloud.pvs[0];

  // Skip when the top PV is a mate line or current eval is infinite — classification isn't meaningful.
  if (topPv.mate !== undefined) return null;
  if (topPv.cp === undefined) return null;
  if (pgnEvalAfter === null || !isFinite(pgnEvalAfter)) return null;

  const bestCp = topPv.cp;
  const isWhiteMove = moveIndex % 2 === 1;

  const uci = sanToUci(fenBefore, san);
  if (!uci) return null;

  // Try to find the played move's cp value in the cloud eval PVs.
  let playedCp: number | null = null;
  for (const pv of cloud.pvs) {
    if (pv.mate !== undefined) continue;
    if (pv.cp === undefined) continue;
    const firstMove = pv.moves.split(' ')[0];
    if (firstMove === uci) {
      playedCp = pv.cp;
      break;
    }
  }

  // Fall back to PGN eval when the played move isn't in the top-5 PVs.
  if (playedCp === null) {
    playedCp = isWhiteMove ? pgnEvalAfter * 100 : -pgnEvalAfter * 100;
  }

  const cpLoss = bestCp - playedCp;

  let quality: MoveQuality;
  if (cpLoss <= EXCELLENT_MAX_CP_LOSS) quality = 'Excellent';
  else if (cpLoss <= GOOD_MAX_CP_LOSS) quality = 'Good';
  else if (cpLoss <= MISTAKE_MAX_CP_LOSS) quality = 'Mistake';
  else quality = 'Miss';

  // Upgrade to Brilliant when: not the top choice, ≤15 cp loss, and it's a material sacrifice.
  const topFirstMove = topPv.moves.split(' ')[0];
  if (uci !== topFirstMove && cpLoss <= BRILLIANT_MAX_CP_LOSS) {
    const landingSquare = uci.slice(2, 4);
    if (isMaterialSacrifice(fenAfter, landingSquare, isWhiteMove ? 'w' : 'b')) {
      quality = 'Brilliant';
    }
  }

  return quality;
}
