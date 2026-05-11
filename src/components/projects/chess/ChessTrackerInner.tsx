'use client';

import { useTournament } from './useTournament';

export function ChessTrackerInner() {
  const { state, retry } = useTournament();

  if (state.phase === 'loading') {
    return (
      <div className="mt-[40px] mb-[48px]" aria-busy="true">
        <p className="font-mono text-[12px] text-muted tracking-[0.04em] uppercase mb-[8px]">
          Loading tournament…
        </p>
      </div>
    );
  }

  if (state.phase === 'empty') {
    return (
      <div className="mt-[40px] mb-[48px]">
        <p className="font-sans text-[15px] text-muted">No active tournaments right now.</p>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="mt-[40px] mb-[48px]">
        <p className="font-sans text-[15px] text-muted mb-[12px]">
          Could not load tournament data.
        </p>
        <button
          onClick={retry}
          className="font-sans text-[13px] font-medium text-ink border border-line-strong px-[16px] py-[7px] rounded hover:bg-bg-soft transition-colors duration-[120ms]"
        >
          Try again
        </button>
      </div>
    );
  }

  // phase === 'ready'
  return (
    <div className="mt-[40px] mb-[48px]">
      <p className="font-mono text-[12px] text-muted tracking-[0.04em] uppercase mb-[8px]">
        Live tournament
      </p>
      <p className="font-serif text-[24px] font-medium leading-[1.3] text-ink">
        {state.tournamentName}
        {state.roundName && (
          <span className="text-muted font-normal"> — {state.roundName}</span>
        )}
      </p>
    </div>
  );
}
