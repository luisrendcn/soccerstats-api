import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertTeam, type InsertPlayer } from "@shared/routes";
import { apiFetch } from "@/lib/api";
import { refreshAppData } from "@/lib/queryClient";
import {
  invalidateOptimisticQueries,
  queryKeyStartsWith,
  removeArrayItemById,
  restoreOptimisticQueries,
  snapshotOptimisticQueries,
  updateOptimisticQueries,
  type QueryKeyPredicate,
  type OptimisticSnapshot,
} from "@/lib/optimistic-cache";
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

function teamDeletePredicate(teamId: number): QueryKeyPredicate {
  return (queryKey) =>
    queryKeyStartsWith(queryKey, [api.teams.list.path]) ||
    queryKeyStartsWith(queryKey, [api.teams.get.path, teamId]) ||
    queryKeyStartsWith(queryKey, [api.matches.list.path]) ||
    (queryKey[0] === "tournaments" && queryKey[2] === "teams");
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation<
    { success: boolean },
    Error,
    number,
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.teams.delete.path, { id });
      const res = await apiFetch(url, {
        method: api.teams.delete.method,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete team");
      }
      return api.teams.delete.responses[200].parse(await res.json());
    },
    onMutate: async (id) => {
      const predicate = teamDeletePredicate(id);
      const snapshot = await snapshotOptimisticQueries(queryClient, predicate);

      if (queryClient.getQueryState([api.teams.get.path, id])) {
        queryClient.setQueryData([api.teams.get.path, id], null);
      }
      updateOptimisticQueries(queryClient, predicate, (data, queryKey) => {
        if (
          queryKeyStartsWith(queryKey, [api.matches.list.path]) &&
          Array.isArray(data)
        ) {
          return data.filter(
            (match) =>
              typeof match === "object" &&
              match !== null &&
              !(
                "homeTeamId" in match &&
                "awayTeamId" in match &&
                ((match as { homeTeamId: unknown }).homeTeamId === id ||
                  (match as { awayTeamId: unknown }).awayTeamId === id)
              ),
          );
        }
        if (queryKey[0] === "tournaments" && queryKey[2] === "teams") {
          return removeArrayItemById(data, id);
        }
        if (
          queryKeyStartsWith(queryKey, [api.teams.list.path]) ||
          queryKeyStartsWith(queryKey, [api.teams.get.path, id])
        ) {
          return removeArrayItemById(data, id);
        }
        return data;
      });

      return { snapshot, predicate };
    },
    onError: (_error, _id, context) => {
      restoreOptimisticQueries(queryClient, context?.snapshot);
    },
    onSettled: (_data, _error, _id, context) => {
      if (context) {
        void invalidateOptimisticQueries(queryClient, context.predicate);
      }
    },
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

function playerDeletePredicate(teamId?: number): QueryKeyPredicate {
  return (queryKey) =>
    queryKeyStartsWith(queryKey, [api.players.list.path]) ||
    (typeof teamId === "number" &&
      queryKeyStartsWith(queryKey, [api.teams.get.path, teamId]));
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();
  return useMutation<
    { success: boolean },
    Error,
    { id: number; teamId?: number },
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
    mutationFn: async ({ id }) => {
      const url = buildUrl(api.players.delete.path, { id });
      const res = await apiFetch(url, {
        method: api.players.delete.method,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete player");
      }
      return api.players.delete.responses[200].parse(await res.json());
    },
    onMutate: async ({ id, teamId }) => {
      const predicate = playerDeletePredicate(teamId);
      const snapshot = await snapshotOptimisticQueries(queryClient, predicate);

      updateOptimisticQueries(queryClient, predicate, (data) =>
        removeArrayItemById(data, id),
      );

      return { snapshot, predicate };
    },
    onError: (_error, _variables, context) => {
      restoreOptimisticQueries(queryClient, context?.snapshot);
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context) {
        void invalidateOptimisticQueries(queryClient, context.predicate);
      }
    },
  });
}

export type PlayersImportResult = {
  created: Array<{ id: number; teamId: number; name: string; number?: number | null }>;
  skipped: Array<{ row: number; name: string; reason: string }>;
};

export function useImportTeamPlayers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      teamId,
      players,
    }: {
      teamId: number;
      players: Array<{ name: string; number?: number | null }>;
    }) => {
      const res = await apiFetch(`/api/teams/${teamId}/players/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to import players");
      }
      return res.json() as Promise<PlayersImportResult>;
    },
    onSuccess: () => refreshAppData(queryClient),
  });
}
