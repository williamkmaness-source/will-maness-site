import type { PlayerStanding, TournamentFormat } from './types';

interface Props {
  standings: PlayerStanding[];
  tournamentName?: string | null;
  isLive?: boolean;
  format: TournamentFormat;
}

function pts(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function StandingsTable({ standings }: { standings: PlayerStanding[] }) {
  return (
    <div className="mt-[24px] overflow-x-auto">
      <table className="w-full text-left border-collapse font-sans text-[14px]">
        <thead>
          <tr className="border-b border-line">
            <th className="pb-[10px] pr-[16px] font-mono text-[11px] text-muted tracking-[0.06em] uppercase w-[32px]">#</th>
            <th className="pb-[10px] pr-[16px] font-mono text-[11px] text-muted tracking-[0.06em] uppercase">Player</th>
            <th className="pb-[10px] pr-[16px] font-mono text-[11px] text-muted tracking-[0.06em] uppercase text-right">Pts</th>
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
              <td className="py-[10px] pr-[16px] text-right font-medium text-ink tabular-nums">{pts(player.points)}</td>
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

function MatchScoreCard({ standings }: { standings: [PlayerStanding, PlayerStanding] }) {
  const [a, b] = standings;
  return (
    <div className="mt-[24px]">
      <div className="flex items-center gap-[12px] bg-bg-soft rounded-[6px] px-[20px] py-[16px]">
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[14px] font-medium text-ink truncate">{a.name}</p>
          <p className="font-mono text-[11px] text-muted tracking-[0.04em] mt-[2px]">
            {a.wins}W {a.draws}D {a.losses}L
          </p>
        </div>
        <div className="shrink-0 text-center">
          <p className="font-mono text-[22px] font-medium tabular-nums text-ink leading-none">
            {pts(a.points)}<span className="text-muted mx-[6px]">–</span>{pts(b.points)}
          </p>
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="font-sans text-[14px] font-medium text-ink truncate">{b.name}</p>
          <p className="font-mono text-[11px] text-muted tracking-[0.04em] mt-[2px]">
            {b.wins}W {b.draws}D {b.losses}L
          </p>
        </div>
      </div>
    </div>
  );
}

export function TournamentStandings({ standings, tournamentName, isLive, format }: Props) {
  if (format === 'unknown') {
    return (
      <p className="font-sans text-[14px] text-muted mt-[8px]">
        {tournamentName
          ? `${tournamentName} uses a format that isn't supported yet.`
          : 'Tournament format not yet supported.'}
      </p>
    );
  }

  if (!standings.length) {
    return (
      <p className="font-sans text-[14px] text-muted mt-[8px]">
        {isLive ? 'Standings will appear once games begin.' : 'No standings available.'}
      </p>
    );
  }

  if (format === 'knockout') {
    if (standings.length === 2) {
      return <MatchScoreCard standings={[standings[0], standings[1]]} />;
    }
    return (
      <>
        <p className="font-mono text-[11px] text-muted tracking-[0.04em] uppercase mt-[20px]">
          Match standings
        </p>
        <StandingsTable standings={standings} />
      </>
    );
  }

  // round-robin
  return <StandingsTable standings={standings} />;
}
