// Shared types for the Vienna Trainer theory tree and game reducer.

export interface TheoryMove {
  san: string;
  from: string;
  to: string;
}

export interface BlackResponse extends TheoryMove {
  weight: number;
  next: WhiteNode | null;
}

export interface WhiteNode {
  id: string;
  turn: 'w';
  moveNumber: number;
  variation: string | null;
  move: TheoryMove;
  next: BlackNode | null;
}

export interface BlackNode {
  id: string;
  turn: 'b';
  moveNumber: number;
  variation: string | null;
  responses: BlackResponse[];
}

export type TheoryNode = WhiteNode | BlackNode;

// ── Reducer ──────────────────────────────────────────────────────────────────

export type Phase = 'playing' | 'complete';

export type HintLevel =
  | 0  // no hint
  | 1  // source square highlighted (attempt 3)
  | 2  // source + destination highlighted (attempt 4)
  | 3; // auto-move (attempt 5)

export interface TrainerState {
  currentNode: TheoryNode;
  moveHistory: string[];   // SAN of each ply played so far
  wrongAttempts: number;
  hintLevel: HintLevel;
  phase: Phase;
}

export type TrainerAction =
  | { type: 'MOVE'; from: string; to: string }
  | { type: 'RESET'; rootNode: TheoryNode };
