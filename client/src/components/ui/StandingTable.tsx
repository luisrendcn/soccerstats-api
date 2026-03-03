import { useStandings } from "@/hooks/use-standings";

interface StandingTableProps {
  title?: string;
  tournamentId?: number;
}

export default function StandingsTable({ title, tournamentId }: StandingTableProps) {
  const { standings, loading, error } = useStandings(tournamentId);

  if (loading) {
    return <p className="mt-4 text-center">Cargando tabla...</p>;
  }

  if (error) {
    return (
      <p className="mt-4 text-center text-red-500">
        Error: {error}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto mt-6">
      {title && <h3 className="text-lg font-display mb-2">{title}</h3>}
      <table className="min-w-full border rounded-lg">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-3 py-2 text-left">Equipo</th>
            <th className="px-3 py-2 text-center">PJ</th>
            <th className="px-3 py-2 text-center">PG</th>
            <th className="px-3 py-2 text-center">PE</th>
            <th className="px-3 py-2 text-center">PP</th>
            <th className="px-3 py-2 text-center">GF</th>
            <th className="px-3 py-2 text-center">GC</th>
            <th className="px-3 py-2 text-center">DG</th>
            <th className="px-3 py-2 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team) => (
            <tr key={team.teamId} className="border-t">
              <td className="px-3 py-2">{team.teamName}</td>
              <td className="px-3 py-2 text-center">{team.played}</td>
              <td className="px-3 py-2 text-center">{team.wins}</td>
              <td className="px-3 py-2 text-center">{team.draws}</td>
              <td className="px-3 py-2 text-center">{team.losses}</td>
              <td className="px-3 py-2 text-center">{team.goalsFor}</td>
              <td className="px-3 py-2 text-center">{team.goalsAgainst}</td>
              <td className="px-3 py-2 text-center">{team.goalDifference}</td>
              <td className="px-3 py-2 text-center font-bold">
                {team.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
