export type TournamentPhase = 'loading' | 'ready' | 'error' | 'empty';

export interface TournamentState {
  phase: TournamentPhase;
  tournamentName: string | null;
  tournamentId: string | null;
  roundName: string | null;
  pollingInterval: number;
}

export type TournamentAction =
  | { type: 'FETCH_SUCCESS'; tournamentName: string; tournamentId: string; roundName: string | null; pollingInterval: number }
  | { type: 'FETCH_EMPTY' }
  | { type: 'FETCH_ERROR' }
  | { type: 'RETRY' };

// Raw shapes from the Lichess Broadcasts API
export interface LichessBroadcastRound {
  id: string;
  name: string;
  slug: string;
  ongoing: boolean;
  finished: boolean;
}

export interface LichessBroadcast {
  tour: {
    id: string;
    name: string;
    slug: string;
  };
  rounds: LichessBroadcastRound[];
}

export interface TopBroadcastResult {
  tournamentName: string;
  tournamentId: string;
  roundName: string | null;
  pollingInterval: number;
}
