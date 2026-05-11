import { describe, it, expect } from 'vitest';
import { tournamentReducer, initialState } from './reducer';
import { DEFAULT_INTERVAL, BACKOFF_INTERVAL } from './BroadcastService';
import type { PlayerStanding, TournamentState } from './types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockStandings: PlayerStanding[] = [
  { rank: 1, name: 'Magnus Carlsen', points: 5, wins: 5, draws: 0, losses: 0 },
  { rank: 2, name: 'Hikaru Nakamura', points: 4, wins: 4, draws: 0, losses: 1 },
];

const readyState: TournamentState = {
  phase: 'ready',
  tournamentName: 'Norway Chess 2026',
  tournamentId: 'tour1',
  roundName: 'Round 4',
  pollingInterval: DEFAULT_INTERVAL,
  standings: mockStandings,
};

const successAction = {
  type: 'FETCH_SUCCESS' as const,
  tournamentName: 'Norway Chess 2026',
  tournamentId: 'tour1',
  roundName: 'Round 4',
  pollingInterval: DEFAULT_INTERVAL,
  standings: mockStandings,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tournamentReducer', () => {
  it('starts in loading phase with null data and empty standings', () => {
    expect(initialState.phase).toBe('loading');
    expect(initialState.tournamentName).toBeNull();
    expect(initialState.standings).toHaveLength(0);
  });

  it('FETCH_SUCCESS transitions to ready and sets all tournament data including standings', () => {
    const next = tournamentReducer(initialState, successAction);

    expect(next.phase).toBe('ready');
    expect(next.tournamentName).toBe('Norway Chess 2026');
    expect(next.tournamentId).toBe('tour1');
    expect(next.roundName).toBe('Round 4');
    expect(next.pollingInterval).toBe(DEFAULT_INTERVAL);
    expect(next.standings).toHaveLength(2);
    expect(next.standings[0].name).toBe('Magnus Carlsen');
  });

  it('FETCH_SUCCESS stores updated standings on each poll', () => {
    const updatedStandings: PlayerStanding[] = [
      { rank: 1, name: 'Magnus Carlsen', points: 6, wins: 6, draws: 0, losses: 0 },
    ];
    const next = tournamentReducer(readyState, { ...successAction, standings: updatedStandings });

    expect(next.standings).toHaveLength(1);
    expect(next.standings[0].points).toBe(6);
  });

  it('FETCH_SUCCESS stores the back-off polling interval when rate-limited', () => {
    const next = tournamentReducer(initialState, { ...successAction, pollingInterval: BACKOFF_INTERVAL });

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

  it('FETCH_ERROR when data exists keeps ready phase and retains standings', () => {
    const next = tournamentReducer(readyState, { type: 'FETCH_ERROR' });

    expect(next.phase).toBe('ready');
    expect(next.tournamentName).toBe('Norway Chess 2026');
    expect(next.standings).toHaveLength(2);
  });

  it('RETRY from error transitions back to loading', () => {
    const errState: TournamentState = { ...initialState, phase: 'error' };
    const next = tournamentReducer(errState, { type: 'RETRY' });
    expect(next.phase).toBe('loading');
  });

  it('FETCH_SUCCESS after RETRY restores ready state with standings', () => {
    const errState: TournamentState = { ...initialState, phase: 'error' };
    const loading = tournamentReducer(errState, { type: 'RETRY' });
    const ready = tournamentReducer(loading, successAction);

    expect(ready.phase).toBe('ready');
    expect(ready.standings).toHaveLength(2);
  });
});
