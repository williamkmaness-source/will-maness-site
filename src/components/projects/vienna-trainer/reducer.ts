'use client';

import {
  BlackNode,
  BlackResponse,
  HintLevel,
  TheoryNode,
  TrainerAction,
  TrainerState,
  WhiteNode,
} from './types';

const HINT_THRESHOLDS: Record<number, HintLevel> = {
  2: 1, // attempt 3 → source square
  3: 2, // attempt 4 → source + destination
  4: 3, // attempt 5 → auto-move
};

function weightedPick(responses: BlackResponse[]): BlackResponse {
  const r = Math.random();
  let cumulative = 0;
  for (const response of responses) {
    cumulative += response.weight;
    if (r <= cumulative) return response;
  }
  return responses[responses.length - 1];
}

function applyBlackResponse(
  state: TrainerState,
  whiteNode: WhiteNode,
): TrainerState {
  const blackNode = whiteNode.next;
  if (!blackNode) {
    return { ...state, currentNode: whiteNode, phase: 'complete' };
  }

  const picked = weightedPick(blackNode.responses);
  const moveHistory = [...state.moveHistory, picked.san];

  if (!picked.next) {
    return { ...state, currentNode: blackNode, moveHistory, phase: 'complete' };
  }

  return { ...state, currentNode: picked.next, moveHistory };
}

export function trainerReducer(
  state: TrainerState,
  action: TrainerAction,
): TrainerState {
  if (action.type === 'RESET') {
    return {
      currentNode: action.rootNode,
      moveHistory: [],
      wrongAttempts: 0,
      hintLevel: 0,
      phase: 'playing',
    };
  }

  if (action.type === 'MOVE') {
    if (state.phase === 'complete') return state;

    const node = state.currentNode as WhiteNode;
    if (node.turn !== 'w') return state;

    const { from, to } = action;
    const correct = node.move;

    if (from === correct.from && to === correct.to) {
      // Correct move — advance and trigger Black's response
      const afterWhite: TrainerState = {
        ...state,
        currentNode: node,
        moveHistory: [...state.moveHistory, correct.san],
        wrongAttempts: 0,
        hintLevel: 0,
      };

      // Transition to complete if this is move 8 (no Black node follows)
      if (!node.next) {
        return { ...afterWhite, phase: 'complete' };
      }

      return applyBlackResponse(afterWhite, node);
    }

    // Wrong move — increment counter and update hint level
    const wrongAttempts = state.wrongAttempts + 1;
    const hintLevel: HintLevel = HINT_THRESHOLDS[wrongAttempts] ?? state.hintLevel;

    if (hintLevel === 3) {
      // Auto-move: play the correct move automatically
      const afterAutoMove: TrainerState = {
        ...state,
        currentNode: node,
        moveHistory: [...state.moveHistory, correct.san],
        wrongAttempts: 0,
        hintLevel: 0,
      };

      if (!node.next) {
        return { ...afterAutoMove, phase: 'complete' };
      }

      return applyBlackResponse(afterAutoMove, node);
    }

    return { ...state, wrongAttempts, hintLevel };
  }

  return state;
}

export function initialState(rootNode: TheoryNode): TrainerState {
  return {
    currentNode: rootNode,
    moveHistory: [],
    wrongAttempts: 0,
    hintLevel: 0,
    phase: 'playing',
  };
}
