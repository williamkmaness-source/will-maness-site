'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { fetchTopBroadcast, fetchRoundData, detectRoundRobin, DEFAULT_INTERVAL } from './BroadcastService';
import { tournamentReducer, initialState } from './reducer';
import type { SelectedGame, TournamentState } from './types';

export interface UseTournamentReturn {
  state: TournamentState;
  retry: () => void;
  selectGame: (game: SelectedGame) => void;
  closeGame: () => void;
}

export function useTournament(): UseTournamentReturn {
  const [state, dispatch] = useReducer(tournamentReducer, initialState);
  // Incremented by retry() to restart the polling effect.
  const [fetchSeq, setFetchSeq] = useState(0);
  // Ref so the polling callback reads the latest interval without re-subscribing.
  const pollingIntervalRef = useRef(DEFAULT_INTERVAL);

  useEffect(() => {
    pollingIntervalRef.current = state.pollingInterval;
  }, [state.pollingInterval]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const { signal } = controller;

    async function poll() {
      try {
        const broadcast = await fetchTopBroadcast(signal);

        if (!broadcast.active) {
          dispatch({ type: 'FETCH_EMPTY', upcoming: broadcast.upcoming });
        } else {
          const { active: _, allRounds, ...broadcastData } = broadcast;
          const { standings, pairings } = await fetchRoundData(allRounds, broadcastData.activeRoundId, signal);
          const unsupportedFormat = !detectRoundRobin(standings, pairings);
          dispatch({ type: 'FETCH_SUCCESS', ...broadcastData, standings, pairings, unsupportedFormat });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        dispatch({ type: 'FETCH_ERROR' });
      }

      if (!signal.aborted) {
        timeoutId = setTimeout(poll, pollingIntervalRef.current);
      }
    }

    poll();

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
    // fetchSeq re-runs this effect when retry() is called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSeq]);

  const retry = useCallback(() => {
    dispatch({ type: 'RETRY' });
    setFetchSeq((n) => n + 1);
  }, []);

  const selectGame = useCallback((game: SelectedGame) => {
    dispatch({ type: 'SELECT_GAME', game });
  }, []);

  const closeGame = useCallback(() => {
    dispatch({ type: 'CLOSE_GAME' });
  }, []);

  return { state, retry, selectGame, closeGame };
}
