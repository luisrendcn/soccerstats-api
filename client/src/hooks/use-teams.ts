import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertTeam, type InsertPlayer } from "@shared/routes";
import { apiFetch } from "@/lib/api";
import { refreshAppData } from "@/lib/queryClient";
import {
  readPersistentCache,
  writePersistentCache,
} from "@/lib/persistentCache";

export function useTeams(page = 1, limit = 10, search = "") {
  const cacheKey = `teams:${page}:${limit}:${search}`;
  const cached = readPersistentCache<Awaited<ReturnType<typeof api.teams.list.responses[200]["parse"]>>>(cacheKey);

  return useQuery({
    queryKey: [api.teams.list.path, page, limit, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      const res = await apiFetch(`${api.teams.list.path}?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch teams');
      const teams = api.teams.list.responses[200].parse(await res.json());
      writePersistentCache(cacheKey, teams);
      return teams;
    },
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.savedAt,

  });
}

export function useTeam(id: number) {
  return useQuery({
    queryKey: [api.teams.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.teams.get.path, { id });
      const res = await apiFetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch team');
      return api.teams.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertTeam) => {
      const validated = api.teams.create.input.parse(data);
      const res = await apiFetch(api.teams.create.path, {
        method: api.teams.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.teams.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error('Failed to create team');
      }
      return api.teams.create.responses[201].parse(await res.json());
    },
    onSuccess: () => refreshAppData(queryClient),
  });
}

export function useTeamPlayers(
  teamId: number,
  page = 1,
  limit = 10,
  search = "",
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: [api.players.list.path, teamId, page, limit, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      const url = `${buildUrl(api.players.list.path, { teamId })}?${params.toString()}`;
      const res = await apiFetch(url, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch players');
      return api.players.list.responses[200].parse(await res.json());
    },
    enabled: options.enabled ?? !!teamId,
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertPlayer) => {
      const validated = api.players.create.input.parse(data);
      const res = await apiFetch(api.players.create.path, {
        method: api.players.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.players.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error('Failed to create player');
      }
      return api.players.create.responses[201].parse(await res.json());
    },
    onSuccess: () => refreshAppData(queryClient),
  });
}
