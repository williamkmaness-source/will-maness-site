'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { fetchTopBroadcast, fetchRoundData, detectFormat, selectActiveRound, DEFAULT_INTERVAL } from './BroadcastService';
import { tournamentReducer, initialState } from './reducer';
import type { SelectedGame, TournamentState } from './types';

export interface UseTournamentReturn {
  state: TournamentState;
  retry: () => void;
  selectGame: (game: SelectedGame) => void;
  closeGame: () => void;
  selectTournament: (tournamentId: string) => void;
}

export function useTournament(): UseTournamentReturn {
  const [state, dispatch] = useReducer(tournamentReducer, initialState);
  // Incremented by retry() or selectTournament() to restart the polling effect.
  const [fetchSeq, setFetchSeq] = useState(0);
  // Refs so polling callbacks read the latest values without re-subscribing.
  const pollingIntervalRef = useRef(DEFAULT_INTERVAL);
  const selectedTournamentIdRef = useRef<string | null>(null);

  useEffect(() => {
    pollingIntervalRef.current = state.pollingInterval;
  }, [state.pollingInterval]);

  useEffect(() => {
    selectedTournamentIdRef.current = state.selectedTournamentId;
  }, [state.selectedTournamentId]);

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
          const { active: _, allActiveTournaments, ...defaultBroadcastData } = broadcast;

          // If the user has selected a specific tournament and it's still active, use it.
          const selectedId = selectedTournamentIdRef.current;
          const selectedOption = selectedId
            ? allActiveTournaments.find((t) => t.id === selectedId)
            : null;

          let allRounds, tournamentId, tournamentName, isLive, roundName, activeRoundId;

          if (selectedOption) {
            allRounds = selectedOption.allRounds;
            tournamentId = selectedOption.id;
            tournamentName = selectedOption.name;
            isLive = selectedOption.isLive;
            const activeRound = selectActiveRound(allRounds);
            activeRoundId = activeRound?.id ?? null;
            roundName = activeRound?.name ?? null;
          } else {
            ({ allRounds, tournamentId, tournamentName, isLive, roundName, activeRoundId } =
              defaultBroadcastData);
          }

          const { standings, pairings, pgnTexts } = await fetchRoundData(
            allRounds,
            activeRoundId,
            signal,
          );
          const format = detectFormat(pgnTexts, standings);

          const availableTournaments = allActiveTournaments.map(({ id, name, isLive: live }) => ({
            id,
            name,
            isLive: live,
          }));

          dispatch({
            type: 'FETCH_SUCCESS',
            isLive,
            tournamentName,
            tournamentId,
            roundName,
            activeRoundId,
            pollingInterval: broadcast.pollingInterval,
            standings,
            pairings,
            upcoming: broadcast.upcoming,
            format,
            availableTournaments,
          });
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
    // fetchSeq re-runs this effect when retry() or selectTournament() is called.
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

  const selectTournament = useCallback((tournamentId: string) => {
    dispatch({ type: 'SELECT_TOURNAMENT', tournamentId });
    // Immediately re-fetch so the new tournament's data loads without waiting for the next poll.
    setFetchSeq((n) => n + 1);
  }, []);

  return { state, retry, selectGame, closeGame, selectTournament };
}
