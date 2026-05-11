import { DEFAULT_INTERVAL } from './BroadcastService';
import type { TournamentAction, TournamentState } from './types';

export const initialState: TournamentState = {
  phase: 'loading',
  tournamentName: null,
  tournamentId: null,
  roundName: null,
  pollingInterval: DEFAULT_INTERVAL,
  standings: [],
};

export function tournamentReducer(
  state: TournamentState,
  action: TournamentAction,
): TournamentState {
  switch (action.type) {
    case 'FETCH_SUCCESS':
      return {
        ...state,
        phase: 'ready',
        tournamentName: action.tournamentName,
        tournamentId: action.tournamentId,
        roundName: action.roundName,
        pollingInterval: action.pollingInterval,
        standings: action.standings,
      };

    case 'FETCH_EMPTY':
      return { ...state, phase: 'empty' };

    case 'FETCH_ERROR':
      // Keep any previously loaded data so the UI doesn't go blank on a failed refresh.
      return { ...state, phase: state.tournamentName ? 'ready' : 'error' };

    case 'RETRY':
      return { ...state, phase: 'loading' };

    default:
      return state;
  }
}
