import { DEFAULT_INTERVAL } from './BroadcastService';
import type { TournamentAction, TournamentState } from './types';

export const initialState: TournamentState = {
  phase: 'loading',
  isLive: false,
  tournamentName: null,
  tournamentId: null,
  roundName: null,
  activeRoundId: null,
  pollingInterval: DEFAULT_INTERVAL,
  standings: [],
  pairings: [],
  selectedGame: null,
  upcoming: null,
  format: 'unknown' as const,
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
        isLive: action.isLive,
        tournamentName: action.tournamentName,
        tournamentId: action.tournamentId,
        roundName: action.roundName,
        activeRoundId: action.activeRoundId,
        pollingInterval: action.pollingInterval,
        standings: action.standings,
        pairings: action.pairings,
        upcoming: action.upcoming,
        format: action.format,
      };

    case 'FETCH_EMPTY':
      return { ...state, phase: 'empty', upcoming: action.upcoming };

    case 'FETCH_ERROR':
      return { ...state, phase: state.tournamentName ? 'ready' : 'error' };

    case 'RETRY':
      return { ...state, phase: 'loading' };

    case 'SELECT_GAME':
      return { ...state, selectedGame: action.game };

    case 'CLOSE_GAME':
      return { ...state, selectedGame: null };

    default:
      return state;
  }
}
