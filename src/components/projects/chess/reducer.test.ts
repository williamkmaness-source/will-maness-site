import { describe, it, expect } from 'vitest';
import { tournamentReducer, initialState } from './reducer';
import { DEFAULT_INTERVAL, BACKOFF_INTERVAL } from './BroadcastService';
import type { TournamentState } from './types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const readyState: TournamentState = {
  phase: 'ready',
  tournamentName: 'Norway Chess 2026',
  tournamentId: 'tour1',
  roundName: 'Round 4',
  pollingInterval: DEFAULT_INTERVAL,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tournamentReducer', () => {
  it('starts in loading phase with null data', () => {
    expect(initialState.phase).toBe('loading');
    expect(initialState.tournamentName).toBeNull();
  });

  it('FETCH_SUCCESS transitions to ready and sets all tournament data', () => {
    const next = tournamentReducer(initialState, {
      type: 'FETCH_SUCCESS',
      tournamentName: 'Norway Chess 2026',
      tournamentId: 'tour1',
      roundName: 'Round 4',
      pollingInterval: DEFAULT_INTERVAL,
    });

    expect(next.phase).toBe('ready');
    expect(next.tournamentName).toBe('Norway Chess 2026');
    expect(next.tournamentId).toBe('tour1');
    expect(next.roundName).toBe('Round 4');
    expect(next.pollingInterval).toBe(DEFAULT_INTERVAL);
  });

  it('FETCH_SUCCESS stores the back-off polling interval when rate-limited', () => {
    const next = tournamentReducer(initialState, {
      type: 'FETCH_SUCCESS',
      tournamentName: 'Candidates 2026',
      tournamentId: 'tour2',
      roundName: 'Round 1',
      pollingInterval: BACKOFF_INTERVAL,
    });

    expect(next.pollingInterval).toBe(BACKOFF_INTERVAL);
  });

  it('FETCH_EMPTY transitions to empty phase', () => {
    const next = tournamentReducer(initialState, { type: 'FETCH_EMPTY' });
    expect(next.phase).toBe('empty');
  });

  it('FETCH_ERROR on initial load transitions to error phase', () => {
    const next = tournamentReducer(initialState, { type: 'FETCH_ERROR' });
    expect(next.phase).toBe('error');
  });

  it('FETCH_ERROR when data exists keeps ready phase and retains data', () => {
    const next = tournamentReducer(readyState, { type: 'FETCH_ERROR' });

    expect(next.phase).toBe('ready');
    expect(next.tournamentName).toBe('Norway Chess 2026');
    expect(next.roundName).toBe('Round 4');
  });

  it('RETRY from error transitions back to loading', () => {
    const errState: TournamentState = { ...initialState, phase: 'error' };
    const next = tournamentReducer(errState, { type: 'RETRY' });
    expect(next.phase).toBe('loading');
  });

  it('FETCH_SUCCESS after RETRY restores ready state', () => {
    const errState: TournamentState = { ...initialState, phase: 'error' };
    const loading = tournamentReducer(errState, { type: 'RETRY' });
    const ready = tournamentReducer(loading, {
      type: 'FETCH_SUCCESS',
      tournamentName: 'Norway Chess 2026',
      tournamentId: 'tour1',
      roundName: 'Round 1',
      pollingInterval: DEFAULT_INTERVAL,
    });

    expect(ready.phase).toBe('ready');
    expect(ready.tournamentName).toBe('Norway Chess 2026');
  });
});
