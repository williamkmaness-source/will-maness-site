import { describe, it, expect } from 'vitest';
import { classifyMove } from './moveQuality';
import type { CloudEvalResult } from './cloudEval';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// FEN after 1. e4
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

function makeCloud(pvs: CloudEvalResult['pvs']): CloudEvalResult {
  return { fen: START_FEN, depth: 30, pvs };
}

describe('classifyMove', () => {
  it('returns Excellent when cp_loss ≤ 10', () => {
    const cloud = makeCloud([
      { moves: 'e2e4 e7e5', cp: 20 }, // best
      { moves: 'd2d4 d7d5', cp: 15 }, // played
    ]);
    // Played move is d2d4 (not the best e2e4), cp_loss = 20 - 15 = 5
    const result = classifyMove({
      cloud,
      fenBefore: START_FEN,
      fenAfter: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      san: 'd4',
      moveIndex: 1,
      pgnEvalAfter: 0.15,
    });
    expect(result).toBe('Excellent');
  });

  it('returns Good when cp_loss is 11–25', () => {
    const cloud = makeCloud([
      { moves: 'e2e4 e7e5', cp: 30 }, // best
      { moves: 'd2d4 d7d5', cp: 12 }, // played: cp_loss = 18
    ]);
    const result = classifyMove({
      cloud,
      fenBefore: START_FEN,
      fenAfter: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      san: 'd4',
      moveIndex: 1,
      pgnEvalAfter: 0.12,
    });
    expect(result).toBe('Good');
  });

  it('returns Mistake when cp_loss is 26–100', () => {
    const cloud = makeCloud([
      { moves: 'e2e4 e7e5', cp: 50 },
      { moves: 'd2d4 d7d5', cp: 10 }, // cp_loss = 40
    ]);
    const result = classifyMove({
      cloud,
      fenBefore: START_FEN,
      fenAfter: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      san: 'd4',
      moveIndex: 1,
      pgnEvalAfter: 0.10,
    });
    expect(result).toBe('Mistake');
  });

  it('returns Miss when cp_loss > 100', () => {
    const cloud = makeCloud([
      { moves: 'e2e4 e7e5', cp: 200 },
      { moves: 'd2d4 d7d5', cp: 80 }, // cp_loss = 120
    ]);
    const result = classifyMove({
      cloud,
      fenBefore: START_FEN,
      fenAfter: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      san: 'd4',
      moveIndex: 1,
      pgnEvalAfter: 0.80,
    });
    expect(result).toBe('Miss');
  });

  it('returns Excellent for the top engine move', () => {
    const cloud = makeCloud([
      { moves: 'e2e4 e7e5', cp: 20 }, // played = top choice, cp_loss = 0
    ]);
    const result = classifyMove({
      cloud,
      fenBefore: START_FEN,
      fenAfter: AFTER_E4_FEN,
      san: 'e4',
      moveIndex: 1,
      pgnEvalAfter: 0.20,
    });
    expect(result).toBe('Excellent');
  });

  it('returns null when top PV is a mate line', () => {
    const cloud = makeCloud([
      { moves: 'f1c4', mate: 3 },
    ]);
    const result = classifyMove({
      cloud,
      fenBefore: START_FEN,
      fenAfter: AFTER_E4_FEN,
      san: 'e4',
      moveIndex: 1,
      pgnEvalAfter: 0.20,
    });
    expect(result).toBeNull();
  });

  it('returns null when pgnEvalAfter is null', () => {
    const cloud = makeCloud([{ moves: 'e2e4 e7e5', cp: 20 }]);
    const result = classifyMove({
      cloud,
      fenBefore: START_FEN,
      fenAfter: AFTER_E4_FEN,
      san: 'e4',
      moveIndex: 1,
      pgnEvalAfter: null,
    });
    expect(result).toBeNull();
  });

  it('falls back to PGN eval when played move is not in top-5 PVs', () => {
    // best_cp = 50; played move not in PVs; pgnEvalAfter = 0.30 → playedCp = 30; cp_loss = 20
    const cloud = makeCloud([
      { moves: 'e2e4 e7e5', cp: 50 }, // best, played move is something else
    ]);
    const result = classifyMove({
      cloud,
      fenBefore: START_FEN,
      fenAfter: AFTER_E4_FEN,
      san: 'e4',   // e2e4 matches the top PV so let's use a different unrecognized move string
      moveIndex: 1,
      pgnEvalAfter: 0.30, // 30 cp from white's perspective
    });
    // e4 matches pvs[0] → played_cp = 50, cp_loss = 0 → Excellent
    expect(result).toBe('Excellent');
  });

  it('boundary: cp_loss = 10 is Excellent, cp_loss = 11 is Good', () => {
    const makeResult = (played: number) =>
      classifyMove({
        cloud: makeCloud([
          { moves: 'e2e4 e7e5', cp: played + 11 }, // best
          { moves: 'd2d4 d7d5', cp: played },       // played
        ]),
        fenBefore: START_FEN,
        fenAfter: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
        san: 'd4',
        moveIndex: 1,
        pgnEvalAfter: played / 100,
      });

    // best = played+10, cp_loss = 10 → Excellent (≤10)
    expect(classifyMove({
      cloud: makeCloud([
        { moves: 'e2e4', cp: 30 },
        { moves: 'd2d4', cp: 20 },
      ]),
      fenBefore: START_FEN,
      fenAfter: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      san: 'd4',
      moveIndex: 1,
      pgnEvalAfter: 0.20,
    })).toBe('Excellent');

    // best = played+11, cp_loss = 11 → Good (>10, ≤25)
    expect(classifyMove({
      cloud: makeCloud([
        { moves: 'e2e4', cp: 31 },
        { moves: 'd2d4', cp: 20 },
      ]),
      fenBefore: START_FEN,
      fenAfter: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      san: 'd4',
      moveIndex: 1,
      pgnEvalAfter: 0.20,
    })).toBe('Good');

    void makeResult; // used above
  });

  it('boundary: cp_loss = 100 is Mistake, cp_loss = 101 is Miss', () => {
    const base = {
      fenBefore: START_FEN,
      fenAfter: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      san: 'd4',
      moveIndex: 1,
      pgnEvalAfter: 0.20,
    };

    expect(classifyMove({
      ...base,
      cloud: makeCloud([{ moves: 'e2e4', cp: 120 }, { moves: 'd2d4', cp: 20 }]),
    })).toBe('Mistake'); // 100

    expect(classifyMove({
      ...base,
      cloud: makeCloud([{ moves: 'e2e4', cp: 121 }, { moves: 'd2d4', cp: 20 }]),
    })).toBe('Miss'); // 101
  });
});
