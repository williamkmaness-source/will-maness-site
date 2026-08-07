"use client";

// use-song-search.ts — one song search's lifecycle (issues #216, #217).
// Each caller owns its own instance, which is what makes the two compare columns
// independent: searching one column never touches the other's state. A request counter
// drops stale responses so a slow first search can't overwrite a fast second one.

import { useCallback, useRef, useState } from "react";
import type { SongBreakdownData } from "@/lib/music-analyzer/song-breakdown";

/** Which API slot this search fills: the lookup view's `q`, or a compare column. */
export type SongSearchSlot = "q" | "a" | "b";

export type SongSearchStatus = "idle" | "loading" | "ready" | "empty" | "error";

export interface SongSearchState {
  status: SongSearchStatus;
  breakdown: SongBreakdownData | null;
  /** Server-supplied error text, when the failure has something worth saying. */
  error: string | null;
}

const IDLE: SongSearchState = { status: "idle", breakdown: null, error: null };

function endpoint(slot: SongSearchSlot, query: string): string {
  const encoded = encodeURIComponent(query);
  return slot === "q"
    ? `/api/music/song?q=${encoded}`
    : `/api/music/compare?${slot}=${encoded}`;
}

export function useSongSearch(slot: SongSearchSlot) {
  const [state, setState] = useState<SongSearchState>(IDLE);
  const requestId = useRef(0);

  const search = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setState(IDLE);
        return;
      }

      const id = ++requestId.current;
      setState({ status: "loading", breakdown: null, error: null });

      try {
        const res = await fetch(endpoint(slot, trimmed));
        const data = (await res.json()) as Record<string, unknown>;
        if (id !== requestId.current) return; // superseded by a newer search

        if (!res.ok) {
          const message = typeof data.error === "string" ? data.error : null;
          setState({ status: "error", breakdown: null, error: message });
          return;
        }

        const key = slot === "q" ? "breakdown" : slot;
        const breakdown = (data[key] ?? null) as SongBreakdownData | null;
        setState(
          breakdown
            ? { status: "ready", breakdown, error: null }
            : { status: "empty", breakdown: null, error: null }
        );
      } catch {
        if (id !== requestId.current) return;
        setState({ status: "error", breakdown: null, error: null });
      }
    },
    [slot]
  );

  return { ...state, search };
}
