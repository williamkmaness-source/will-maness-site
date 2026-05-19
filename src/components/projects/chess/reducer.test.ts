import { describe, it, expect } from 'vitest';
import { tournamentReducer, initialState } from './reducer';
import { DEFAULT_INTERVAL, BACKOFF_INTERVAL } from './BroadcastService';
import type { GamePairing, PlayerStanding, SelectedGame, TournamentState } from './types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockStandings: PlayerStanding[] = [
  { rank: 1, name: 'Magnus Carlsen', points: 5, wins: 5, draws: 0, losses: 0 },
  { rank: 2, name: 'Hikaru Nakamura', points: 4, wins: 4, draws: 0, losses: 1 },
];

const mockPairings: GamePairing[] = [
  { gameId: 'gAAA', white: 'Magnus Carlsen', black: 'Hikaru Nakamura', result: '1-0', isCompleted: true },
  { gameId: 'gBBB', white: 'Fabiano Caruana', black: 'Ian Nepomniachtchi', result: '*', isCompleted: false },
];

const mockAvailableTournaments = [
  { id: 'tour1', name: 'Norway Chess 2026', isLive: true },
];

const readyState: TournamentState = {
  phase: 'ready',
  isLive: true,
  tournamentName: 'Norway Chess 2026',
  tournamentId: 'tour1',
  roundName: 'Round 4',
  activeRoundId: 'r4',
  pollingInterval: DEFAULT_INTERVAL,
  standings: mockStandings,
  pairings: mockPairings,
  selectedGame: null,
  upcoming: null,
  format: 'round-robin' as const,
  availableTournaments: mockAvailableTournaments,
  selectedTournamentId: null,
};

const successAction = {
  type: 'FETCH_SUCCESS' as const,
  isLive: true,
  tournamentName: 'Norway Chess 2026',
  tournamentId: 'tour1',
  roundName: 'Round 4',
  activeRoundId: 'r4',
  pollingInterval: DEFAULT_INTERVAL,
  standings: mockStandings,
  pairings: mockPairings,
  upcoming: null,
  format: 'round-robin' as const,
  availableTournaments: mockAvailableTournaments,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tournamentReducer', () => {
  it('starts in loading phase with empty collections and null selections', () => {
    expect(initialState.phase).toBe('loading');
    expect(initialState.tournamentName).toBeNull();
    expect(initialState.standings).toHaveLength(0);
    expect(initialState.pairings).toHaveLength(0);
    expect(initialState.selectedGame).toBeNull();
    expect(initialState.isLive).toBe(false);
    expect(initialState.upcoming).toBeNull();
  });

  it('FETCH_SUCCESS transitions to ready and sets all fields', () => {
    const next = tournamentReducer(initialState, successAction);

    expect(next.phase).toBe('ready');
    expect(next.isLive).toBe(true);
    expect(next.tournamentName).toBe('Norway Chess 2026');
    expect(next.roundName).toBe('Round 4');
    expect(next.activeRoundId).toBe('r4');
    expect(next.standings).toHaveLength(2);
    expect(next.pairings).toHaveLength(2);
    expect(next.upcoming).toBeNull();
  });

  it('FETCH_SUCCESS preserves selectedGame so the open modal survives polling', () => {
    const game = { roundId: 'r4', gameId: 'gAAA', white: 'A', black: 'B', isLive: false };
    const withGame: TournamentState = { ...readyState, selectedGame: game };
    const next = tournamentReducer(withGame, successAction);
    expect(next.selectedGame).toEqual(game);
  });

  it('FETCH_SUCCESS stores upcoming tournament when not live', () => {
    const action = { ...successAction, isLive: false, upcoming: { name: 'GCT Romania 2026', startsAt: 9_000_000 } };
    const next = tournamentReducer(initialState, action);

    expect(next.isLive).toBe(false);
    expect(next.upcoming!.name).toBe('GCT Romania 2026');
  });

  it('FETCH_SUCCESS stores the back-off polling interval when rate-limited', () => {
    const next = tournamentReducer(initialState, { ...successAction, pollingInterval: BACKOFF_INTERVAL });
    expect(next.pollingInterval).toBe(BACKOFF_INTERVAL);
  });

  it('FETCH_EMPTY transitions to empty phase', () => {
    expect(tournamentReducer(initialState, { type: 'FETCH_EMPTY', upcoming: null }).phase).toBe('empty');
  });

  it('FETCH_ERROR on initial load transitions to error phase', () => {
    expect(tournamentReducer(initialState, { type: 'FETCH_ERROR' }).phase).toBe('error');
  });

  it('FETCH_ERROR when data exists keeps ready phase and retains standings and pairings', () => {
    const next = tournamentReducer(readyState, { type: 'FETCH_ERROR' });

    expect(next.phase).toBe('ready');
    expect(next.standings).toHaveLength(2);
    expect(next.pairings).toHaveLength(2);
  });

  it('RETRY transitions back to loading', () => {
    const errState: TournamentState = { ...initialState, phase: 'error' };
    expect(tournamentReducer(errState, { type: 'RETRY' }).phase).toBe('loading');
  });

  it('SELECT_GAME stores the selected game', () => {
    const game: SelectedGame = { roundId: 'r4', gameId: 'gAAA', white: 'Magnus Carlsen', black: 'Hikaru Nakamura', isLive: false };
    const next = tournamentReducer(readyState, { type: 'SELECT_GAME', game });

    expect(next.selectedGame).toEqual(game);
  });

  it('CLOSE_GAME clears the selected game', () => {
    const withGame: TournamentState = {
      ...readyState,
      selectedGame: { roundId: 'r4', gameId: 'gAAA', white: 'A', black: 'B', isLive: false },
    };
    const next = tournamentReducer(withGame, { type: 'CLOSE_GAME' });
    expect(next.selectedGame).toBeNull();
  });

  it('FETCH_SUCCESS after RETRY restores ready state with standings and pairings', () => {
    const errState: TournamentState = { ...initialState, phase: 'error' };
    const ready = tournamentReducer(tournamentReducer(errState, { type: 'RETRY' }), successAction);

    expect(ready.phase).toBe('ready');
    expect(ready.standings).toHaveLength(2);
    expect(ready.pairings).toHaveLength(2);
  });

  it('FETCH_SUCCESS stores the detected format', () => {
    const next = tournamentReducer(initialState, successAction);
    expect(next.format).toBe('round-robin');
  });

  it('FETCH_SUCCESS stores knockout format when detected', () => {
    const next = tournamentReducer(initialState, { ...successAction, format: 'knockout' as const });
    expect(next.format).toBe('knockout');
  });

  it('FETCH_SUCCESS stores the availableTournaments list', () => {
    const next = tournamentReducer(initialState, successAction);
    expect(next.availableTournaments).toHaveLength(1);
    expect(next.availableTournaments[0].id).toBe('tour1');
  });

  it('FETCH_SUCCESS preserves a valid selectedTournamentId across polls', () => {
    const withSelection: TournamentState = { ...readyState, selectedTournamentId: 'tour1' };
    const next = tournamentReducer(withSelection, successAction);
    expect(next.selectedTournamentId).toBe('tour1');
  });

  it('FETCH_SUCCESS clears selectedTournamentId when tournament is no longer active', () => {
    const withSelection: TournamentState = { ...readyState, selectedTournamentId: 'tour-gone' };
    const next = tournamentReducer(withSelection, successAction);
    expect(next.selectedTournamentId).toBeNull();
  });

  it('SELECT_TOURNAMENT sets the selectedTournamentId', () => {
    const next = tournamentReducer(readyState, { type: 'SELECT_TOURNAMENT', tournamentId: 'tour2' });
    expect(next.selectedTournamentId).toBe('tour2');
  });

  it('SELECT_TOURNAMENT does not change other state fields', () => {
    const next = tournamentReducer(readyState, { type: 'SELECT_TOURNAMENT', tournamentId: 'tour2' });
    expect(next.standings).toEqual(readyState.standings);
    expect(next.tournamentName).toBe(readyState.tournamentName);
    expect(next.phase).toBe('ready');
  });
});

// ── Error and empty states (issue #30) ───────────────────────────────────────

describe('error and empty state behaviour', () => {
  it('initial fetch failure shows error phase with no standings visible', () => {
    const next = tournamentReducer(initialState, { type: 'FETCH_ERROR' });
    expect(next.phase).toBe('error');
    expect(next.standings).toHaveLength(0);
  });

  it('empty broadcast list shows empty phase, not error phase', () => {
    const next = tournamentReducer(initialState, { type: 'FETCH_EMPTY', upcoming: null });
    expect(next.phase).toBe('empty');
  });

  it('RETRY after error phase re-enters loading so a re-fetch can occur', () => {
    const errState: TournamentState = { ...initialState, phase: 'error' };
    expect(tournamentReducer(errState, { type: 'RETRY' }).phase).toBe('loading');
  });

  it('refresh failure while data exists keeps standings and pairings visible', () => {
    const next = tournamentReducer(readyState, { type: 'FETCH_ERROR' });
    expect(next.phase).toBe('ready');
    expect(next.standings).toHaveLength(2);
    expect(next.pairings).toHaveLength(2);
  });
});
