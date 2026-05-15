'use client';

import type { GamePairing, SelectedGame } from './types';

interface Props {
  pairings: GamePairing[];
  activeRoundId: string | null;
  onSelectGame: (game: SelectedGame) => void;
}

export function PairingsTable({ pairings, activeRoundId, onSelectGame }: Props) {
  if (!pairings.length) return null;

  return (
    <div className="mt-[28px]">
      <p className="font-mono text-[12px] text-muted tracking-[0.04em] uppercase mb-[12px]">
        Pairings
      </p>
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr className="border-b border-line">
            <th className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase text-left pb-[8px] pr-[12px]">
              White
            </th>
            <th className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase text-center pb-[8px] px-[12px] w-[60px]">
              Result
            </th>
            <th className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase text-right pb-[8px] pl-[12px]">
              Black
            </th>
          </tr>
        </thead>
        <tbody>
          {pairings.map((pairing) => {
            const inProgress = pairing.result === '*';
            const clickable = activeRoundId !== null && (pairing.isCompleted || inProgress);
            const selectGame = clickable
              ? () => onSelectGame({ roundId: activeRoundId!, gameId: pairing.gameId, white: pairing.white, black: pairing.black, isLive: inProgress })
              : undefined;
            return (
              <tr
                key={pairing.gameId}
                onClick={selectGame}
                onKeyDown={selectGame ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectGame(); } } : undefined}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                className={[
                  'border-b border-line transition-colors duration-[100ms]',
                  clickable
                    ? 'cursor-pointer hover:bg-bg-soft focus-visible:outline-none focus-visible:bg-bg-soft'
                    : 'cursor-default',
                ].join(' ')}
              >
                <td className="font-sans text-[14px] text-ink py-[10px] pr-[12px] truncate max-w-0">
                  {pairing.white}
                </td>
                <td className="text-center py-[10px] px-[12px] w-[60px]">
                  {inProgress ? (
                    <span className="inline-flex items-center gap-[5px] font-mono text-[10px] tracking-[0.06em] uppercase text-ink">
                      <span className="w-[6px] h-[6px] rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                      Live
                    </span>
                  ) : (
                    <span className="font-mono text-[13px] text-muted">{pairing.result}</span>
                  )}
                </td>
                <td className="font-sans text-[14px] text-ink text-right py-[10px] pl-[12px] truncate max-w-0">
                  {pairing.black}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
