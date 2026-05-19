export type TournamentPhase = 'loading' | 'ready' | 'error' | 'empty';

export interface AvailableTournament {
  id: string;
  name: string;
  isLive: boolean;
}

export interface PlayerStanding {
  rank: number;
  name: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface GamePairing {
  gameId: string;
  white: string;
  black: string;
  result: string; // '1-0' | '0-1' | '1/2-1/2' | '*'
  isCompleted: boolean;
}

export interface SelectedGame {
  roundId: string;
  gameId: string;
  white: string;
  black: string;
  isLive: boolean;
}

export interface GameMoveData {
  san: string;
  fen: string;
  eval: number | null;
  clock: string | null; // remaining time for the player who made this move (H:MM:SS)
  captured: string | null; // piece type captured on this move, e.g. 'p', 'n', 'B'
}

export interface UpcomingTournament {
  name: string;
  startsAt: number | null; // Unix ms timestamp; null when API omits it
}

export type TournamentFormat = 'round-robin' | 'knockout' | 'unknown';

export interface TournamentState {
  phase: TournamentPhase;
  isLive: boolean;
  tournamentName: string | null;
  tournamentId: string | null;
  roundName: string | null;
  activeRoundId: string | null;
  pollingInterval: number;
  standings: PlayerStanding[];
  pairings: GamePairing[];
  selectedGame: SelectedGame | null;
  upcoming: UpcomingTournament | null;
  format: TournamentFormat;
  availableTournaments: AvailableTournament[];
  selectedTournamentId: string | null;
}

export type TournamentAction =
  | {
      type: 'FETCH_SUCCESS';
      isLive: boolean;
      tournamentName: string;
      tournamentId: string;
      roundName: string | null;
      activeRoundId: string | null;
      pollingInterval: number;
      standings: PlayerStanding[];
      pairings: GamePairing[];
      upcoming: UpcomingTournament | null;
      format: TournamentFormat;
      availableTournaments: AvailableTournament[];
    }
  | { type: 'FETCH_EMPTY'; upcoming: UpcomingTournament | null }
  | { type: 'FETCH_ERROR' }
  | { type: 'RETRY' }
  | { type: 'SELECT_GAME'; game: SelectedGame }
  | { type: 'CLOSE_GAME' }
  | { type: 'SELECT_TOURNAMENT'; tournamentId: string };

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
    tier?: number;
  };
  rounds: LichessBroadcastRound[];
}

export interface ActiveTournamentOption {
  id: string;
  name: string;
  isLive: boolean;
  allRounds: LichessBroadcastRound[];
}

export type TopBroadcastResult =
  | {
      active: true;
      isLive: boolean;
      tournamentName: string;
      tournamentId: string;
      roundName: string | null;
      activeRoundId: string | null;
      pollingInterval: number;
      allRounds: LichessBroadcastRound[];
      upcoming: UpcomingTournament | null;
      allActiveTournaments: ActiveTournamentOption[];
    }
  | {
      active: false;
      upcoming: UpcomingTournament | null;
      pollingInterval: number;
    };
