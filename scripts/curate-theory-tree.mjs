// curate-theory-tree.mjs
// Builds theory.json from hard-coded Vienna Opening lines.
// Uses chess.js to validate each move and produce correct SAN.
// Run: node scripts/curate-theory-tree.mjs

import { Chess } from 'chess.js';
import { writeFileSync, mkdirSync } from 'fs';

// 5 complete lines, each 15 plies (White plays moves 1–8, Black plays 1–7).
// White's 8th move is the terminal node. Lines share prefixes — the builder merges them.
const LINES = [
  {
    variation: 'Vienna Gambit',
    // 1.e4 e5 2.Nc3 Nf6 3.f4 d5 4.fxe5 Nxe4 5.Nf3 Bg4 6.d3 Nc5 7.d4 Ne6 8.Be3
    uci: ['e2e4','e7e5','b1c3','g8f6','f2f4','d7d5','f4e5','f6e4','g1f3','c8g4','d2d3','e4c5','d3d4','c5e6','c1e3'],
  },
  {
    variation: 'Vienna Gambit',
    // 1.e4 e5 2.Nc3 Nf6 3.f4 exf4 4.e5 Ng8 5.Nf3 d6 6.d4 dxe5 7.dxe5 Nc6 8.Bc4
    uci: ['e2e4','e7e5','b1c3','g8f6','f2f4','e5f4','e4e5','f6g8','g1f3','d7d6','d2d4','d6e5','d4e5','b8c6','f1c4'],
  },
  {
    variation: 'Symmetrical Vienna',
    // 1.e4 e5 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7 5.d3 d6 6.Be3 Nf6 7.Nge2 O-O 8.O-O
    uci: ['e2e4','e7e5','b1c3','b8c6','g2g3','g7g6','f1g2','f8g7','d2d3','d7d6','c1e3','g8f6','g1e2','e8g8','e1g1'],
  },
  {
    variation: 'Symmetrical Vienna',
    // 1.e4 e5 2.Nc3 Nc6 3.g3 Nf6 4.Bg2 Bc5 5.Nge2 d6 6.O-O O-O 7.d3 a6 8.Be3
    // Note: f4 is illegal here — Bc5 pins the f2 pawn against the castled king on g1.
    // Be3 is the principled response, attacking the Bc5.
    uci: ['e2e4','e7e5','b1c3','b8c6','g2g3','g8f6','f1g2','f8c5','g1e2','d7d6','e1g1','e8g8','d2d3','a7a6','c1e3'],
  },
  {
    variation: 'Vienna with ...Bc5',
    // 1.e4 e5 2.Nc3 Bc5 3.Bc4 Nf6 4.d3 Nc6 5.Be3 Bb6 6.Nf3 d6 7.O-O O-O 8.h3
    // Be3 attacks Bc5 before castling — without it, Bc5 controls g1 and O-O is illegal.
    uci: ['e2e4','e7e5','b1c3','f8c5','f1c4','g8f6','d2d3','b8c6','c1e3','c5b6','g1f3','d7d6','e1g1','e8g8','h2h3'],
  },
];

// Weights for Black responses at branch points.
// Key = moves played before Black moves (comma-joined UCI).
const WEIGHTS = {
  'e2e4,e7e5,b1c3':            { 'g8f6': 0.44, 'b8c6': 0.31, 'f8c5': 0.25 },
  'e2e4,e7e5,b1c3,g8f6,f2f4': { 'd7d5': 0.62, 'e5f4': 0.38 },
  'e2e4,e7e5,b1c3,b8c6,g2g3': { 'g7g6': 0.55, 'g8f6': 0.45 },
};

// The White node that opens each named branch gets this variation name.
// Key = all UCI moves played INCLUDING the branch-causing Black move.
const VARIATION_START = {
  'e2e4,e7e5,b1c3,g8f6': 'Vienna Gambit',
  'e2e4,e7e5,b1c3,b8c6': 'Symmetrical Vienna',
  'e2e4,e7e5,b1c3,f8c5': 'Vienna with ...Bc5',
};

function build(chess, lines, played, inherited) {
  const ply = played.length;
  if (ply >= 15) return null;

  const isWhite = ply % 2 === 0;
  const moveNumber = Math.floor(ply / 2) + 1;
  const posKey = played.join(',');

  // Group remaining lines by their next UCI move
  const groups = new Map();
  for (const line of lines) {
    if (ply >= line.uci.length) continue;
    const uci = line.uci[ply];
    if (!groups.has(uci)) groups.set(uci, []);
    groups.get(uci).push(line);
  }
  if (!groups.size) return null;

  if (isWhite) {
    if (groups.size > 1) {
      throw new Error(`White move conflict at ply ${ply} (${posKey}): ${[...groups.keys()]}`);
    }
    const [[uci, nextLines]] = groups;
    let mv;
    try {
      mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    } catch (e) {
      console.error(`\nFailed white move: ${uci} at ply ${ply}`);
      console.error(`Position (FEN): ${chess.fen()}`);
      console.error(`Played: ${posKey}`);
      throw e;
    }
    const variation = VARIATION_START[posKey] ?? inherited;
    const node = {
      id: `w${ply}`,
      turn: 'w',
      moveNumber,
      variation,
      move: { san: mv.san, from: uci.slice(0, 2), to: uci.slice(2, 4) },
      next: build(chess, nextLines, [...played, uci], variation),
    };
    chess.undo();
    return node;
  } else {
    const weightMap = WEIGHTS[posKey] ?? {};
    const total = [...groups.keys()].reduce((s, u) => s + (weightMap[u] ?? 0), 0);

    const responses = [];
    for (const [uci, nextLines] of groups) {
      const mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
      const w = total > 0 ? (weightMap[uci] ?? 0) / total : 1 / groups.size;
      responses.push({
        san: mv.san,
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        weight: Math.round(w * 1000) / 1000,
        next: build(chess, nextLines, [...played, uci], inherited),
      });
      chess.undo();
    }

    return { id: `b${ply}`, turn: 'b', moveNumber, variation: inherited, responses };
  }
}

const tree = build(new Chess(), LINES, [], null);

mkdirSync('content/projects/vienna-trainer', { recursive: true });
writeFileSync(
  'content/projects/vienna-trainer/theory.json',
  JSON.stringify(tree, null, 2),
);
console.log('theory.json written.');
