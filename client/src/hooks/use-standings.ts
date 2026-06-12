import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

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

export function useStandings(tournamentId: number) {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = `/api/standings?tournamentId=${tournamentId}`;
    setLoading(true);
    setError(null);

    apiFetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.message || "No se pudo cargar la tabla de posiciones");
        }
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
