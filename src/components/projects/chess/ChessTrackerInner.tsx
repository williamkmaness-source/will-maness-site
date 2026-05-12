'use client';

import { useTournament } from './useTournament';
import { TournamentStandings } from './TournamentStandings';
import { PairingsTable } from './PairingsTable';
import { GameModal } from './GameModal';

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(ms));
}

export function ChessTrackerInner() {
  const { state, retry, selectGame, closeGame } = useTournament();

  if (state.phase === 'loading') {
    return (
      <div className="mt-[40px] mb-[48px]" aria-busy="true">
        <p className="font-mono text-[12px] text-muted tracking-[0.04em] uppercase">
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
  const label = state.isLive ? 'Live tournament' : 'Previous tournament';

  return (
    <div className="mt-[40px] mb-[48px]">
      <p className="font-mono text-[12px] text-muted tracking-[0.04em] uppercase mb-[8px]">
        {label}
      </p>
      <p className="font-serif text-[24px] font-medium leading-[1.3] text-ink">
        {state.tournamentName}
        {state.roundName && (
          <span className="text-muted font-normal"> — {state.roundName}</span>
        )}
      </p>

      <TournamentStandings
        standings={state.standings}
        tournamentName={state.tournamentName}
        isLive={state.isLive}
        unsupportedFormat={state.unsupportedFormat}
      />

      <PairingsTable
        pairings={state.pairings}
        activeRoundId={state.pairingsRoundId}
        onSelectGame={selectGame}
      />

      {state.selectedGame && (
        <GameModal game={state.selectedGame} onClose={closeGame} />
      )}

      {!state.isLive && state.upcoming && (
        <div className="mt-[32px] pt-[24px] border-t border-line">
          <p className="font-mono text-[12px] text-muted tracking-[0.04em] uppercase mb-[6px]">
            Next tournament
          </p>
          <p className="font-sans text-[15px] text-ink font-medium">{state.upcoming.name}</p>
          <p className="font-sans text-[13px] text-muted mt-[2px]">
            Starts {formatDate(state.upcoming.startsAt)}
          </p>
        </div>
      )}
    </div>
  );
}
