import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateMatchHighlightInput,
  MatchHighlight,
  UpdateMatchHighlightInput,
} from "@shared/schema";
import { apiFetch } from "@/lib/api";
import {
  invalidateOptimisticQueries,
  patchArrayItemById,
  prependUniqueArrayItem,
  queryKeyStartsWith,
  removeArrayItemById,
  replaceArrayItemById,
  restoreOptimisticQueries,
  snapshotOptimisticQueries,
  updateOptimisticQueries,
  type OptimisticSnapshot,
  type QueryKeyPredicate,
} from "@/lib/optimistic-cache";

export interface HighlightThumbnailSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  resourceType: "image";
  maxFileSizeBytes: number;
}

export function useMatchHighlights(matchId: number) {
  return useQuery({
    queryKey: ["matches", matchId, "highlights"],
    queryFn: async () => {
      const res = await apiFetch(`/api/matches/${matchId}/highlights`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch highlights");
      return res.json() as Promise<MatchHighlight[]>;
    },
    enabled: !!matchId,
  });
}

export function useHighlightThumbnailSignature(matchId: number) {
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch(
        `/api/matches/${matchId}/highlights/thumbnail-signature`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to prepare image upload");
      }
      return res.json() as Promise<HighlightThumbnailSignature>;
    },
  });
}

export function useCreateMatchHighlight(matchId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateMatchHighlightInput) => {
      const res = await apiFetch(`/api/matches/${matchId}/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create highlight");
      }
      return res.json() as Promise<MatchHighlight>;
    },
    onSuccess: (highlight) => {
      updateOptimisticQueries(queryClient, highlightPredicate(matchId), (data) =>
        prependUniqueArrayItem(data, highlight),
      );
      void invalidateOptimisticQueries(queryClient, highlightPredicate(matchId));
    },
  });
}

export function useUpdateMatchHighlight(matchId: number) {
  const queryClient = useQueryClient();
  return useMutation<
    MatchHighlight,
    Error,
    { id: number } & UpdateMatchHighlightInput,
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
    mutationFn: async ({
      id,
      ...data
    }: { id: number } & UpdateMatchHighlightInput) => {
      const res = await apiFetch(`/api/match-highlights/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update highlight");
      }
      return res.json() as Promise<MatchHighlight>;
    },
    onMutate: async ({ id, ...data }) => {
      const predicate = highlightPredicate(matchId);
      const snapshot = await snapshotOptimisticQueries(queryClient, predicate);

      updateOptimisticQueries(queryClient, predicate, (current) =>
        patchArrayItemById(current, id, data),
      );

      return { snapshot, predicate };
    },
    onError: (_error, _variables, context) => {
      restoreOptimisticQueries(queryClient, context?.snapshot);
    },
    onSuccess: (highlight) => {
      updateOptimisticQueries(queryClient, highlightPredicate(matchId), (data) =>
        replaceArrayItemById(data, highlight),
      );
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context) {
        void invalidateOptimisticQueries(queryClient, context.predicate);
      }
    },
  });
}

export function useDeleteMatchHighlight(matchId: number) {
  const queryClient = useQueryClient();
  return useMutation<
    { success: boolean },
    Error,
    number,
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/match-highlights/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete highlight");
      }
      return res.json() as Promise<{ success: boolean }>;
    },
    onMutate: async (id) => {
      const predicate = highlightPredicate(matchId);
      const snapshot = await snapshotOptimisticQueries(queryClient, predicate);

      updateOptimisticQueries(queryClient, predicate, (data) =>
        removeArrayItemById(data, id),
      );

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

function highlightPredicate(matchId: number): QueryKeyPredicate {
  return (queryKey) => queryKeyStartsWith(queryKey, ["matches", matchId, "highlights"]);
}
