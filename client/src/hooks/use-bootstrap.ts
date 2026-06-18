import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Match, Team, Tournament } from "@shared/schema";
import { api } from "@shared/routes";
import { apiFetch } from "@/lib/api";
import {
  readPersistentCache,
  writePersistentCache,
} from "@/lib/persistentCache";

export interface BootstrapData {
  teams: Team[];
  matches: Match[];
  tournaments: Tournament[];
  generatedAt: string;
}

const BOOTSTRAP_CACHE_KEY = "bootstrap:v1";
const MATCHES_CACHE_KEY = "matches:1:10:";
const TEAMS_CACHE_KEY = "teams:1:10:";
const TOURNAMENTS_CACHE_KEY = "tournaments";

function persistBootstrap(data: BootstrapData) {
  writePersistentCache(BOOTSTRAP_CACHE_KEY, data);
  writePersistentCache(MATCHES_CACHE_KEY, data.matches);
  writePersistentCache(TEAMS_CACHE_KEY, data.teams);
  writePersistentCache(TOURNAMENTS_CACHE_KEY, data.tournaments);
}

export function useBootstrap() {
  const queryClient = useQueryClient();
  const cached = useMemo(
    () => readPersistentCache<BootstrapData>(BOOTSTRAP_CACHE_KEY),
    [],
  );

  const query = useQuery({
    queryKey: ["bootstrap"],
    queryFn: async () => {
      const res = await apiFetch("/api/bootstrap", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bootstrap data");
      const data = (await res.json()) as BootstrapData;
      persistBootstrap(data);
      return data;
    },
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.savedAt,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!query.data) return;

    queryClient.setQueryData(
      [api.matches.list.path, 1, 10, ""],
      query.data.matches,
    );
    queryClient.setQueryData(
      [api.teams.list.path, 1, 10, ""],
      query.data.teams,
    );
    queryClient.setQueryData(["tournaments"], query.data.tournaments);
  }, [query.data, queryClient]);

  return query;
}
