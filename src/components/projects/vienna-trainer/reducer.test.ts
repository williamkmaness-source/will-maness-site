import { describe, expect, it } from 'vitest';
import { trainerReducer, initialState } from './reducer';
import { WhiteNode, BlackNode, TrainerState } from './types';

// ── Minimal tree fixtures ────────────────────────────────────────────────────

// A 2-move deep tree: White plays e4 → Black plays e5 → White plays Nc3 (terminal)
const leaf: WhiteNode = {
  id: 'w2',
  turn: 'w',
  moveNumber: 2,
  variation: 'Test',
  move: { san: 'Nc3', from: 'b1', to: 'c3' },
  next: null,
};

const blackNode: BlackNode = {
  id: 'b1',
  turn: 'b',
  moveNumber: 1,
  variation: null,
  responses: [{ san: 'e5', from: 'e7', to: 'e5', weight: 1.0, next: leaf }],
};

const root: WhiteNode = {
  id: 'w1',
  turn: 'w',
  moveNumber: 1,
  variation: null,
  move: { san: 'e4', from: 'e2', to: 'e4' },
  next: blackNode,
};

// A tree where Black has two weighted responses
const afterNc3_Nf6: WhiteNode = {
  id: 'w3_nf6',
  turn: 'w',
  moveNumber: 3,
  variation: 'Vienna Gambit',
  move: { san: 'f4', from: 'f2', to: 'f4' },
  next: null,
};

const afterNc3_Nc6: WhiteNode = {
  id: 'w3_nc6',
  turn: 'w',
  moveNumber: 3,
  variation: 'Symmetrical Vienna',
  move: { san: 'g3', from: 'g2', to: 'g3' },
  next: null,
};

const branchBlack: BlackNode = {
  id: 'b2',
  turn: 'b',
  moveNumber: 2,
  variation: null,
  responses: [
    { san: 'Nf6', from: 'g8', to: 'f6', weight: 0.6, next: afterNc3_Nf6 },
    { san: 'Nc6', from: 'b8', to: 'c6', weight: 0.4, next: afterNc3_Nc6 },
  ],
};

const rootWithBranch: WhiteNode = {
  id: 'w1',
  turn: 'w',
  moveNumber: 1,
  variation: null,
  move: { san: 'e4', from: 'e2', to: 'e4' },
  next: {
    id: 'b1',
    turn: 'b',
    moveNumber: 1,
    variation: null,
    responses: [{ san: 'e5', from: 'e7', to: 'e5', weight: 1.0, next: {
      id: 'w2',
      turn: 'w',
      moveNumber: 2,
      variation: null,
      move: { san: 'Nc3', from: 'b1', to: 'c3' },
      next: branchBlack,
    }}],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function playCorrect(state: TrainerState) {
  const node = state.currentNode as WhiteNode;
  return trainerReducer(state, { type: 'MOVE', from: node.move.from, to: node.move.to });
}

function playWrong(state: TrainerState) {
  return trainerReducer(state, { type: 'MOVE', from: 'a1', to: 'a2' });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('trainerReducer', () => {
  it('correct white move advances past black response and resets counters', () => {
    const state = initialState(root);
    const next = playCorrect(state);
    // After e4, Black auto-plays e5, landing on the Nc3 node
    expect((next.currentNode as WhiteNode).move.san).toBe('Nc3');
    expect(next.moveHistory).toEqual(['e4', 'e5']);
    expect(next.wrongAttempts).toBe(0);
    expect(next.hintLevel).toBe(0);
  });

  it('wrong white move increments counter and does not advance node', () => {
    const state = initialState(root);
    const next = playWrong(state);
    expect(next.currentNode).toBe(root);
    expect(next.wrongAttempts).toBe(1);
    expect(next.moveHistory).toHaveLength(0);
  });

  it('wrong attempt 3 (counter=2) sets hint level 1 (source square)', () => {
    let state = initialState(root);
    state = playWrong(state); // attempt 1 → counter=1
    state = playWrong(state); // attempt 2 → counter=2
    expect(state.hintLevel).toBe(1);
  });

  it('wrong attempt 4 (counter=3) sets hint level 2 (source + destination)', () => {
    let state = initialState(root);
    for (let i = 0; i < 3; i++) state = playWrong(state);
    expect(state.hintLevel).toBe(2);
  });

  it('wrong attempt 5 (counter=4) triggers auto-move and resets hints', () => {
    let state = initialState(root);
    for (let i = 0; i < 4; i++) state = playWrong(state);
    // Auto-move fires: e4 is played, Black responds e5, land on Nc3 node
    expect((state.currentNode as WhiteNode).move.san).toBe('Nc3');
    expect(state.wrongAttempts).toBe(0);
    expect(state.hintLevel).toBe(0);
    expect(state.moveHistory).toEqual(['e4', 'e5']);
  });

  it('correct move after hints resets counter and hint level', () => {
    let state = initialState(root);
    state = playWrong(state);
    state = playWrong(state); // hint level 1
    expect(state.hintLevel).toBe(1);
    state = playCorrect(state);
    expect(state.wrongAttempts).toBe(0);
    expect(state.hintLevel).toBe(0);
  });

  it('black weighted-random response always lands on a valid child node', () => {
    // Run 50 trials — every result must land on a valid WhiteNode
    for (let i = 0; i < 50; i++) {
      let state = initialState(rootWithBranch);
      state = playCorrect(state); // e4, Black plays e5
      state = playCorrect(state); // Nc3, Black plays Nf6 or Nc6
      // currentNode is the White node for move 3 — always valid
      expect(state.currentNode.turn).toBe('w');
      expect(state.currentNode.moveNumber).toBe(3);
    }
  });

  it('session transitions to complete at the terminal move', () => {
    // The leaf node has next: null — completing after the correct move
    const terminalState: TrainerState = {
      currentNode: leaf,
      moveHistory: ['e4', 'e5'],
      wrongAttempts: 0,
      hintLevel: 0,
      phase: 'playing',
    };
    const done = playCorrect(terminalState);
    expect(done.phase).toBe('complete');
  });

  it('moves after completion are ignored', () => {
    const terminalState: TrainerState = {
      currentNode: leaf,
      moveHistory: [],
      wrongAttempts: 0,
      hintLevel: 0,
      phase: 'playing',
    };
    const done = playCorrect(terminalState);
    expect(done.phase).toBe('complete');
    const after = playCorrect(done);
    expect(after).toBe(done); // same reference — no state change
  });

  it('reset returns to initial node with all counters cleared', () => {
    let state = initialState(root);
    state = playWrong(state);
    state = playWrong(state);
    state = playCorrect(state);
    const reset = trainerReducer(state, { type: 'RESET', rootNode: root });
    expect(reset.currentNode).toBe(root);
    expect(reset.moveHistory).toHaveLength(0);
    expect(reset.wrongAttempts).toBe(0);
    expect(reset.hintLevel).toBe(0);
    expect(reset.phase).toBe('playing');
  });
});
