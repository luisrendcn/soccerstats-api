import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertMatch, type InsertGoal } from "@shared/routes";
import { apiFetch } from "@/lib/api";
import { refreshAppData } from "@/lib/queryClient";
import {
  invalidateOptimisticQueries,
  patchArrayItemById,
  queryKeyStartsWith,
  removeArrayItemById,
  replaceArrayItemById,
  restoreOptimisticQueries,
  snapshotOptimisticQueries,
  updateOptimisticQueries,
  type OptimisticSnapshot,
  type QueryKeyPredicate,
} from "@/lib/optimistic-cache";
import {
  readPersistentCache,
  writePersistentCache,
} from "@/lib/persistentCache";

export function useMatches(page = 1, limit = 10, search = "") {
  const cacheKey = `matches:${page}:${limit}:${search}`;
  const cached = readPersistentCache<Awaited<ReturnType<typeof api.matches.list.responses[200]["parse"]>>>(cacheKey);

  return useQuery({
    queryKey: [api.matches.list.path, page, limit, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      const res = await apiFetch(`${api.matches.list.path}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch matches');
      const matches = api.matches.list.responses[200].parse(await res.json());
      writePersistentCache(cacheKey, matches);
      return matches;
    },
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.savedAt,
  });
}

export function useMatch(id: number) {
  return useQuery({
    queryKey: [api.matches.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.matches.get.path, { id });
      const res = await apiFetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch match');
      return api.matches.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertMatch) => {
      // Ensure dates are strings for JSON serialization if they aren't already
      const payload = {
        ...data,
        date: new Date(data.date).toISOString() // Serialize date
      };
      
      const res = await apiFetch(api.matches.create.path, {
        method: api.matches.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.matches.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error('Failed to create match');
      }
      return api.matches.create.responses[201].parse(await res.json());
    },
    onSuccess: () => refreshAppData(queryClient),
  });
}

export function useUpdateMatch() {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof api.matches.update.responses[200]["parse"]>>,
    Error,
    { id: number } & Partial<InsertMatch>,
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertMatch>) => {
      const url = buildUrl(api.matches.update.path, { id });
      const res = await apiFetch(url, {
        method: api.matches.update.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update match');
      return api.matches.update.responses[200].parse(await res.json());
    },
    onMutate: async ({ id, ...updates }) => {
      const predicate = matchUpdatePredicate(id);
      const snapshot = await snapshotOptimisticQueries(queryClient, predicate);

      updateOptimisticQueries(queryClient, predicate, (data, queryKey) => {
        if (Array.isArray(data)) {
          return patchArrayItemById(data, id, updates);
        }
        if (queryKeyStartsWith(queryKey, [api.matches.get.path, id])) {
          return data && typeof data === "object" ? { ...data, ...updates } : data;
        }
        return data;
      });

      return { snapshot, predicate };
    },
    onError: (_error, _variables, context) => {
      restoreOptimisticQueries(queryClient, context?.snapshot);
    },
    onSuccess: (match, variables) => {
      const predicate = matchUpdatePredicate(variables.id);
      queryClient.setQueryData([api.matches.get.path, variables.id], match);
      updateOptimisticQueries(queryClient, predicate, (data) =>
        replaceArrayItemById(data, match),
      );
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context) {
        void invalidateOptimisticQueries(queryClient, context.predicate);
      }
    },
  });
}

function matchUpdatePredicate(matchId: number): QueryKeyPredicate {
  return (queryKey) =>
    queryKeyStartsWith(queryKey, [api.matches.list.path]) ||
    queryKeyStartsWith(queryKey, [api.matches.get.path, matchId]);
}

function matchDeletePredicate(matchId: number): QueryKeyPredicate {
  return (queryKey) =>
    matchUpdatePredicate(matchId)(queryKey) ||
    queryKeyStartsWith(queryKey, [api.goals.list.path, matchId]) ||
    queryKeyStartsWith(queryKey, ["matches", matchId]);
}

export function useDeleteMatch() {
  const queryClient = useQueryClient();
  return useMutation<
    { success: boolean },
    Error,
    number,
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.matches.delete.path, { id });
      const res = await apiFetch(url, {
        method: api.matches.delete.method,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete match");
      }
      return api.matches.delete.responses[200].parse(await res.json());
    },
    onMutate: async (id) => {
      const predicate = matchDeletePredicate(id);
      const snapshot = await snapshotOptimisticQueries(queryClient, predicate);

      if (queryClient.getQueryState([api.matches.get.path, id])) {
        queryClient.setQueryData([api.matches.get.path, id], null);
      }
      updateOptimisticQueries(queryClient, predicate, (data, queryKey) => {
        if (queryKeyStartsWith(queryKey, [api.matches.list.path])) {
          return removeArrayItemById(data, id);
        }
        if (
          queryKeyStartsWith(queryKey, [api.goals.list.path, id]) ||
          queryKeyStartsWith(queryKey, ["matches", id, "highlights"])
        ) {
          return [];
        }
        return data;
      });

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

export function useMatchGoals(matchId: number) {
  return useQuery({
    queryKey: [api.goals.list.path, matchId],
    queryFn: async () => {
      const url = buildUrl(api.goals.list.path, { matchId });
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('Failed to fetch goals');
      return api.goals.list.responses[200].parse(await res.json());
    },
    enabled: !!matchId,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertGoal) => {
      const validated = api.goals.create.input.parse(data);
      const res = await apiFetch(api.goals.create.path, {
        method: api.goals.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error('Failed to add goal');
      return api.goals.create.responses[201].parse(await res.json());
    },
    onSuccess: () => refreshAppData(queryClient),
  });
}
