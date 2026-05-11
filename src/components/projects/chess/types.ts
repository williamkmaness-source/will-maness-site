export type TournamentPhase = 'loading' | 'ready' | 'error' | 'empty';

export interface PlayerStanding {
  rank: number;
  name: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface TournamentState {
  phase: TournamentPhase;
  tournamentName: string | null;
  tournamentId: string | null;
  roundName: string | null;
  pollingInterval: number;
  standings: PlayerStanding[];
}

export type TournamentAction =
  | { type: 'FETCH_SUCCESS'; tournamentName: string; tournamentId: string; roundName: string | null; pollingInterval: number; standings: PlayerStanding[] }
  | { type: 'FETCH_EMPTY' }
  | { type: 'FETCH_ERROR' }
  | { type: 'RETRY' };

// Raw shapes from the Lichess Broadcasts API
export interface LichessBroadcastRound {
  id: string;
  name: string;
  slug: string;
  startsAt: number;
  ongoing?: boolean;
  finished?: boolean;
  finishedAt?: number;
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
  allRounds: LichessBroadcastRound[];
}
