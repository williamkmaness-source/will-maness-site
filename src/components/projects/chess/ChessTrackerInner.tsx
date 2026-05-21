'use client';

import { useTournament } from './useTournament';
import { TournamentStandings } from './TournamentStandings';
import { PairingsTable } from './PairingsTable';
import { GameModal } from './GameModal';
import type { AvailableTournament } from './types';

function formatDate(ms: number | null): string | null {
  if (ms == null || !isFinite(ms)) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(ms));
}

function TournamentDropdown({
  tournaments,
  selectedId,
  onSelect,
}: {
  tournaments: AvailableTournament[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mb-[16px]">
      <p className="font-mono text-[11px] text-hint tracking-[0.04em] uppercase mb-[8px]">
        Select tournament
      </p>
      <div className="flex flex-wrap gap-[8px]">
        {tournaments.map((t) => {
          const isActive = t.id === selectedId;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              aria-pressed={isActive}
              className={[
                'font-mono text-[12px] px-[12px] py-[5px] rounded-sm border transition-colors duration-[120ms] cursor-pointer',
                isActive
                  ? 'bg-ink text-bg border-ink'
                  : 'bg-bg text-muted border-line hover:border-ink hover:text-ink',
              ].join(' ')}
            >
              {t.isLive && (
                <span className="inline-block w-[6px] h-[6px] rounded-full bg-accent mr-[6px] align-middle" />
              )}
              {t.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ChessTrackerInner() {
  const { state, retry, selectGame, closeGame, selectTournament } = useTournament();

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
        <p className="font-sans text-[15px] text-muted">No notable tournaments are active right now.</p>
        {state.upcoming && (
          <div className="mt-[24px] pt-[24px] border-t border-line">
            <p className="font-mono text-[12px] text-muted tracking-[0.04em] uppercase mb-[6px]">
              Next tournament
            </p>
            <p className="font-sans text-[15px] text-ink font-medium">{state.upcoming.name}</p>
            {formatDate(state.upcoming.startsAt) && (
              <p className="font-sans text-[13px] text-muted mt-[2px]">
                Starts {formatDate(state.upcoming.startsAt)}
              </p>
            )}
          </div>
        )}
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
  const label = state.isLive ? 'Tournament — live' : 'Tournament';

  return (
    <div className="mt-[40px] mb-[48px]">
      {state.availableTournaments.length > 1 && (
        <TournamentDropdown
          tournaments={state.availableTournaments}
          selectedId={state.selectedTournamentId ?? state.tournamentId}
          onSelect={selectTournament}
        />
      )}
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
        format={state.format}
      />

      <PairingsTable
        pairings={state.pairings}
        activeRoundId={state.activeRoundId}
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
          {formatDate(state.upcoming.startsAt) && (
            <p className="font-sans text-[13px] text-muted mt-[2px]">
              Starts {formatDate(state.upcoming.startsAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
