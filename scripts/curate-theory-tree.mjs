// curate-theory-tree.mjs
// Builds theory.json from hard-coded Vienna Opening lines.
// Uses chess.js to validate each move and produce correct SAN.
// Run: node scripts/curate-theory-tree.mjs

import { Chess } from 'chess.js';
import { writeFileSync, mkdirSync } from 'fs';

// 10 complete lines, each 15 plies (White plays moves 1–8, Black plays 1–7).
// White's 8th move is the terminal node. Lines share prefixes — the builder merges them.
const LINES = [
  // ── Vienna Gambit Declined ────────────────────────────────────────────────
  {
    variation: 'Vienna Gambit Declined',
    // 1.e4 e5 2.Nc3 Nf6 3.f4 d5 4.fxe5 Nxe4 5.Nf3 Bg4 6.d3 Nc5 7.d4 Ne6 8.Be3
    uci: ['e2e4','e7e5','b1c3','g8f6','f2f4','d7d5','f4e5','f6e4','g1f3','c8g4','d2d3','e4c5','d3d4','c5e6','c1e3'],
  },
  // ── Vienna Gambit Accepted ────────────────────────────────────────────────
  {
    variation: 'Vienna Gambit Accepted',
    // 1.e4 e5 2.Nc3 Nf6 3.f4 exf4 4.e5 Ng8 5.Nf3 d6 6.d4 dxe5 7.dxe5 Nc6 8.Bc4
    uci: ['e2e4','e7e5','b1c3','g8f6','f2f4','e5f4','e4e5','f6g8','g1f3','d7d6','d2d4','d6e5','d4e5','b8c6','f1c4'],
  },
  // ── Vienna Gambit — Steinitz Defense ─────────────────────────────────────
  {
    variation: 'Vienna Gambit — Steinitz Defense',
    // 1.e4 e5 2.Nc3 Nf6 3.f4 d6 4.Nf3 Nc6 5.Bc4 Be7 6.d3 O-O 7.O-O Bg4 8.Be3
    uci: ['e2e4','e7e5','b1c3','g8f6','f2f4','d7d6','g1f3','b8c6','f1c4','f8e7','d2d3','e8g8','e1g1','c8g4','c1e3'],
  },
  // ── Symmetrical Vienna — Fianchetto ──────────────────────────────────────
  {
    variation: 'Symmetrical Vienna — Fianchetto',
    // 1.e4 e5 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7 5.d3 d6 6.Be3 Nf6 7.Nge2 O-O 8.O-O
    uci: ['e2e4','e7e5','b1c3','b8c6','g2g3','g7g6','f1g2','f8g7','d2d3','d7d6','c1e3','g8f6','g1e2','e8g8','e1g1'],
  },
  // ── Symmetrical Vienna — ...Nf6 ──────────────────────────────────────────
  {
    variation: 'Symmetrical Vienna — ...Nf6',
    // 1.e4 e5 2.Nc3 Nc6 3.g3 Nf6 4.Bg2 Bc5 5.Nge2 d6 6.O-O O-O 7.d3 a6 8.Be3
    // Be3 is the principled response, attacking Bc5 once the king is safe.
    uci: ['e2e4','e7e5','b1c3','b8c6','g2g3','g8f6','f1g2','f8c5','g1e2','d7d6','e1g1','e8g8','d2d3','a7a6','c1e3'],
  },
  // ── Symmetrical Vienna — ...Bc5 ──────────────────────────────────────────
  {
    variation: 'Symmetrical Vienna — ...Bc5',
    // 1.e4 e5 2.Nc3 Nc6 3.g3 Bc5 4.Bg2 d6 5.d3 Nf6 6.Nge2 O-O 7.O-O Be6 8.h3
    uci: ['e2e4','e7e5','b1c3','b8c6','g2g3','f8c5','f1g2','d7d6','d2d3','g8f6','g1e2','e8g8','e1g1','c8e6','h2h3'],
  },
  // ── Symmetrical Vienna — ...d6 ───────────────────────────────────────────
  {
    variation: 'Symmetrical Vienna — ...d6',
    // 1.e4 e5 2.Nc3 Nc6 3.g3 d6 4.Bg2 Be6 5.d3 g6 6.f4 Nge7 7.Nf3 Bg7 8.O-O
    uci: ['e2e4','e7e5','b1c3','b8c6','g2g3','d7d6','f1g2','c8e6','d2d3','g7g6','f2f4','g8e7','g1f3','f8g7','e1g1'],
  },
  // ── Vienna with ...Bc5 — Mainline ────────────────────────────────────────
  {
    variation: 'Vienna with ...Bc5 — Mainline',
    // 1.e4 e5 2.Nc3 Bc5 3.Bc4 Nf6 4.d3 Nc6 5.Be3 Bb6 6.Nf3 d6 7.O-O O-O 8.h3
    // Be3 attacks Bc5 before castling — without it, Bc5 controls g1 and O-O is illegal.
    uci: ['e2e4','e7e5','b1c3','f8c5','f1c4','g8f6','d2d3','b8c6','c1e3','c5b6','g1f3','d7d6','e1g1','e8g8','h2h3'],
  },
  // ── Vienna with ...Bc5 — ...d6 System ────────────────────────────────────
  {
    variation: 'Vienna with ...Bc5 — ...d6 System',
    // 1.e4 e5 2.Nc3 Bc5 3.Bc4 d6 4.Nf3 Nc6 5.d3 Nf6 6.Be3 Bb6 7.O-O O-O 8.h3
    uci: ['e2e4','e7e5','b1c3','f8c5','f1c4','d7d6','g1f3','b8c6','d2d3','g8f6','c1e3','c5b6','e1g1','e8g8','h2h3'],
  },
  // ── Vienna with ...Bc5 — ...Nc6 ──────────────────────────────────────────
  {
    variation: 'Vienna with ...Bc5 — ...Nc6',
    // 1.e4 e5 2.Nc3 Bc5 3.Bc4 Nc6 4.d3 Nf6 5.Be3 Bb6 6.Nf3 d6 7.O-O O-O 8.h3
    uci: ['e2e4','e7e5','b1c3','f8c5','f1c4','b8c6','d2d3','g8f6','c1e3','c5b6','g1f3','d7d6','e1g1','e8g8','h2h3'],
  },
];

// Weights for Black responses at branch points.
// Key = moves played before Black moves (comma-joined UCI).
// Weights are relative frequencies; the builder normalizes them automatically.
const WEIGHTS = {
  // After 1.e4 e5 2.Nc3 — Black's 2nd move
  'e2e4,e7e5,b1c3': { 'g8f6': 0.44, 'b8c6': 0.31, 'f8c5': 0.25 },
  // After 1.e4 e5 2.Nc3 Nf6 3.f4 — Black's 3rd move
  // Declined (d5) most common, Accepted (exf4) second, Steinitz (d6) ~10%
  'e2e4,e7e5,b1c3,g8f6,f2f4': { 'd7d5': 0.55, 'e5f4': 0.35, 'd7d6': 0.10 },
  // After 1.e4 e5 2.Nc3 Nc6 3.g3 — Black's 3rd move
  // g6 and Nf6 are the main lines; Bc5 and d6 are recognised sidelines
  'e2e4,e7e5,b1c3,b8c6,g2g3': { 'g7g6': 0.50, 'g8f6': 0.38, 'f8c5': 0.08, 'd7d6': 0.04 },
  // After 1.e4 e5 2.Nc3 Bc5 3.Bc4 — Black's 3rd move
  // Nf6 mainline; Nc6 and d6 are common alternatives
  'e2e4,e7e5,b1c3,f8c5,f1c4': { 'g8f6': 0.60, 'b8c6': 0.25, 'd7d6': 0.15 },
};

// The White node that opens each named branch gets this variation name.
// Key = all UCI moves played INCLUDING the branch-causing Black move.
const VARIATION_START = {
  // Main variation labels (applied at White's 3rd move)
  'e2e4,e7e5,b1c3,g8f6': 'Vienna Gambit',
  'e2e4,e7e5,b1c3,b8c6': 'Symmetrical Vienna',
  'e2e4,e7e5,b1c3,f8c5': 'Vienna with ...Bc5',

  // Vienna Gambit sub-variations (applied at White's 4th move)
  'e2e4,e7e5,b1c3,g8f6,f2f4,d7d5': 'Vienna Gambit Declined',
  'e2e4,e7e5,b1c3,g8f6,f2f4,e5f4': 'Vienna Gambit Accepted',
  'e2e4,e7e5,b1c3,g8f6,f2f4,d7d6': 'Vienna Gambit — Steinitz Defense',

  // Symmetrical Vienna sub-variations (applied at White's 4th move)
  'e2e4,e7e5,b1c3,b8c6,g2g3,g7g6': 'Symmetrical Vienna — Fianchetto',
  'e2e4,e7e5,b1c3,b8c6,g2g3,g8f6': 'Symmetrical Vienna — ...Nf6',
  'e2e4,e7e5,b1c3,b8c6,g2g3,f8c5': 'Symmetrical Vienna — ...Bc5',
  'e2e4,e7e5,b1c3,b8c6,g2g3,d7d6': 'Symmetrical Vienna — ...d6',

  // Vienna with ...Bc5 sub-variations (applied at White's 4th move)
  'e2e4,e7e5,b1c3,f8c5,f1c4,g8f6': 'Vienna with ...Bc5 — Mainline',
  'e2e4,e7e5,b1c3,f8c5,f1c4,d7d6': 'Vienna with ...Bc5 — ...d6 System',
  'e2e4,e7e5,b1c3,f8c5,f1c4,b8c6': 'Vienna with ...Bc5 — ...Nc6',
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
