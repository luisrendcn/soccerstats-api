import { useEffect, useState } from "react";

export interface Standing {
  teamId: number;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export function useStandings(tournamentId?: number) {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let url = "/api/standings";
    if (tournamentId !== undefined) {
      url += `?tournamentId=${tournamentId}`;
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load standings");
        return res.json();
      })
      .then(setStandings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tournamentId]);

  return {
    standings,
    loading,
    error,
  };
}
