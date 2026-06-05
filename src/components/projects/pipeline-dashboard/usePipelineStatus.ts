'use client';

import { useEffect, useRef, useState } from 'react';
import type { PipelineConnectionState, PipelineStatus } from './types';

const ENDPOINT = '/api/pipeline-status';
const RECONNECT_DELAY_MS = 3_000;

export function usePipelineStatus(): PipelineConnectionState {
  const [state, setState] = useState<PipelineConnectionState>({
    statuses: [],
    connected: false,
  });
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const connectRef = useRef<() => void>(() => {});

  useEffect(() => {
    function connect() {
      const es = new EventSource(ENDPOINT);
      esRef.current = es;

      es.addEventListener('status', (e: MessageEvent) => {
        try {
          const statuses: PipelineStatus[] = JSON.parse(e.data);
          setState({ statuses, connected: true });
        } catch {
          // malformed payload — skip
        }
      });

      es.onerror = () => {
        es.close();
        setState((prev) => ({ ...prev, connected: false }));
        clearTimeout(reconnectRef.current);
        reconnectRef.current = setTimeout(connectRef.current, RECONNECT_DELAY_MS);
      };
    }

    connectRef.current = connect;
    connect();

    return () => {
      esRef.current?.close();
      clearTimeout(reconnectRef.current);
    };
  }, []);

  return state;
}
