import type { PlayerStanding } from './types';

interface Props {
  standings: PlayerStanding[];
}

export function TournamentStandings({ standings }: Props) {
  if (!standings.length) {
    return (
      <p className="font-sans text-[14px] text-muted mt-[8px]">
        Standings will appear once games begin.
      </p>
    );
  }

  return (
    <div className="mt-[24px] overflow-x-auto">
      <table className="w-full text-left border-collapse font-sans text-[14px]">
        <thead>
          <tr className="border-b border-line">
            <th className="pb-[10px] pr-[16px] font-mono text-[11px] text-muted tracking-[0.06em] uppercase w-[32px]">#</th>
            <th className="pb-[10px] pr-[16px] font-mono text-[11px] text-muted tracking-[0.06em] uppercase">Player</th>
            <th className="pb-[10px] pr-[16px] font-mono text-[11px] text-muted tracking-[0.06em] uppercase text-right">Pts</th>
            {/* W/D/L hidden on mobile, shown at sm breakpoint and above */}
            <th className="pb-[10px] pr-[16px] font-mono text-[11px] text-muted tracking-[0.06em] uppercase text-right hidden sm:table-cell">W</th>
            <th className="pb-[10px] pr-[16px] font-mono text-[11px] text-muted tracking-[0.06em] uppercase text-right hidden sm:table-cell">D</th>
            <th className="pb-[10px] font-mono text-[11px] text-muted tracking-[0.06em] uppercase text-right hidden sm:table-cell">L</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((player) => (
            <tr
              key={player.name}
              className="border-b border-line last:border-0 hover:bg-bg-soft transition-colors duration-[80ms]"
            >
              <td className="py-[10px] pr-[16px] font-mono text-[12px] text-muted">{player.rank}</td>
              <td className="py-[10px] pr-[16px] text-ink font-medium">{player.name}</td>
              <td className="py-[10px] pr-[16px] text-right font-medium text-ink tabular-nums">
                {player.points % 1 === 0 ? player.points : player.points.toFixed(1)}
              </td>
              <td className="py-[10px] pr-[16px] text-right text-muted tabular-nums hidden sm:table-cell">{player.wins}</td>
              <td className="py-[10px] pr-[16px] text-right text-muted tabular-nums hidden sm:table-cell">{player.draws}</td>
              <td className="py-[10px] text-right text-muted tabular-nums hidden sm:table-cell">{player.losses}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
