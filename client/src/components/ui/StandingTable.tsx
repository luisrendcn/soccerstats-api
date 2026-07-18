import { useStandings } from "@/hooks/use-standings";
import { useLanguage } from "@/lib/i18n.tsx";

interface StandingTableProps {
  title?: string;
  tournamentId: number;
}

export default function StandingsTable({ title, tournamentId }: StandingTableProps) {
  const { standings, loading, error } = useStandings(tournamentId);
  const { t } = useLanguage();

  if (loading) {
    return <p className="mt-4 text-center">{t("loading")}</p>;
  }

  if (error) {
    return (
      <p className="mt-4 text-center text-red-500">
        {t("error")}: {error}
      </p>
    );
  }

  return (
    <div className="mt-6 w-full overflow-hidden">
      {title && <h3 className="text-lg font-display mb-2">{title}</h3>}
      <table className="w-full table-fixed overflow-hidden rounded-lg border text-[10px] sm:text-xs">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[8.75%]" />
          <col className="w-[8.75%]" />
          <col className="w-[8.75%]" />
          <col className="w-[8.75%]" />
          <col className="w-[8.75%]" />
          <col className="w-[8.75%]" />
          <col className="w-[8.75%]" />
          <col className="w-[8.75%]" />
        </colgroup>
        <thead className="bg-gray-100">
          <tr>
            <th className="px-1.5 py-2 text-left">{t("teamsTitle")}</th>
            <th className="px-0.5 py-2 text-center">PJ</th>
            <th className="px-0.5 py-2 text-center">PG</th>
            <th className="px-0.5 py-2 text-center">PE</th>
            <th className="px-0.5 py-2 text-center">PP</th>
            <th className="px-0.5 py-2 text-center">GF</th>
            <th className="px-0.5 py-2 text-center">GC</th>
            <th className="px-0.5 py-2 text-center">DG</th>
            <th className="px-0.5 py-2 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team) => (
            <tr key={team.teamId} className="border-t">
              <td className="truncate px-1.5 py-2 font-medium" title={team.teamName}>
                {team.teamName}
              </td>
              <td className="px-0.5 py-2 text-center tabular-nums">{team.played}</td>
              <td className="px-0.5 py-2 text-center tabular-nums">{team.wins}</td>
              <td className="px-0.5 py-2 text-center tabular-nums">{team.draws}</td>
              <td className="px-0.5 py-2 text-center tabular-nums">{team.losses}</td>
              <td className="px-0.5 py-2 text-center tabular-nums">{team.goalsFor}</td>
              <td className="px-0.5 py-2 text-center tabular-nums">{team.goalsAgainst}</td>
              <td className="px-0.5 py-2 text-center tabular-nums">{team.goalDifference}</td>
              <td className="px-0.5 py-2 text-center font-bold tabular-nums">
                {team.points}
              </td>
            </tr>
          ))}
          {standings.length === 0 && (
            <tr className="border-t">
              <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                {t("tournamentHasNoTeams")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
