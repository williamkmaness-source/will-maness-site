'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { fetchTopBroadcast, DEFAULT_INTERVAL } from './BroadcastService';
import { tournamentReducer, initialState } from './reducer';
import type { TournamentState } from './types';

export interface UseTournamentReturn {
  state: TournamentState;
  retry: () => void;
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

    async function poll() {
      try {
        const result = await fetchTopBroadcast(controller.signal);
        if (result === null) {
          dispatch({ type: 'FETCH_EMPTY' });
        } else {
          dispatch({ type: 'FETCH_SUCCESS', ...result });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        dispatch({ type: 'FETCH_ERROR' });
      }

      if (!controller.signal.aborted) {
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

  return { state, retry };
}
