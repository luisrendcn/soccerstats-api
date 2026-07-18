import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tournament, CreateTournamentInput, UpdateTournamentInput, Team, InsertTeam } from "@shared/schema";
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

export function useTournaments() {
  const cached = readPersistentCache<Tournament[]>("tournaments");

  return useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const res = await apiFetch("/api/tournaments", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tournaments");
      const tournaments = (await res.json()) as Tournament[];
      writePersistentCache("tournaments", tournaments);
      return tournaments;
    },
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.savedAt,
  });
}

export function useTournament(id: number) {
  return useQuery({
    queryKey: ["tournaments", id],
    queryFn: async () => {
      const res = await apiFetch(`/api/tournaments/${id}`, { credentials: "include" });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch tournament");
      }
      return res.json() as Promise<Tournament>;
    },
    enabled: !!id,
    retry: false,
  });
}

export function useCreateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTournamentInput) => {
      const res = await apiFetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create tournament");
      }
      return res.json() as Promise<Tournament>;
    },
    onSuccess: () => refreshAppData(queryClient),
  });
}

export function useUpdateTournament() {
  const queryClient = useQueryClient();
  return useMutation<
    Tournament,
    Error,
    { id: number; data: UpdateTournamentInput },
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
    mutationFn: async ({ id, data }: { id: number; data: UpdateTournamentInput }) => {
      const res = await apiFetch(`/api/tournaments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update tournament");
      }
      return res.json() as Promise<Tournament>;
    },
    onMutate: async ({ id, data }) => {
      const predicate = tournamentPredicate(id);
      const snapshot = await snapshotOptimisticQueries(queryClient, predicate);

      updateOptimisticQueries(queryClient, predicate, (current, queryKey) => {
        if (queryKey.length === 2 && queryKeyStartsWith(queryKey, ["tournaments", id])) {
          return current && typeof current === "object"
            ? { ...current, ...data }
            : current;
        }
        if (queryKey.length === 1 && queryKeyStartsWith(queryKey, ["tournaments"])) {
          return patchArrayItemById(current, id, data);
        }
        return current;
      });

      return { snapshot, predicate };
    },
    onError: (_error, _variables, context) => {
      restoreOptimisticQueries(queryClient, context?.snapshot);
    },
    onSuccess: (tournament) => {
      queryClient.setQueryData(["tournaments", tournament.id], tournament);
      updateOptimisticQueries(queryClient, (queryKey) => queryKey.length === 1 && queryKeyStartsWith(queryKey, ["tournaments"]), (data) =>
        replaceArrayItemById(data, tournament),
      );
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context) {
        void invalidateOptimisticQueries(queryClient, context.predicate);
      }
    },
  });
}

export interface TournamentBackgroundSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  resourceType: "image";
  maxFileSizeBytes: number;
}

export interface TournamentBackgroundUpload {
  backgroundImageUrl: string;
  fileSizeBytes?: number;
}

export function useTournamentBackgroundSignature() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/tournaments/background-signature", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to prepare background upload");
      }
      return res.json() as Promise<TournamentBackgroundSignature>;
    },
  });
}

export function useUploadTournamentBackground() {
  return useMutation({
    mutationFn: async ({
      imageDataUrl,
      fileSizeBytes,
    }: {
      imageDataUrl: string;
      fileSizeBytes: number;
    }) => {
      const res = await apiFetch("/api/tournaments/background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl, fileSizeBytes }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to upload tournament background");
      }
      return res.json() as Promise<TournamentBackgroundUpload>;
    },
  });
}

export function useDeleteTournament() {
  const queryClient = useQueryClient();
  return useMutation<
    unknown,
    Error,
    number,
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/tournaments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete tournament");
      }
      return res.json();
    },
    onMutate: async (id) => {
      const predicate = tournamentPredicate(id);
      const snapshot = await snapshotOptimisticQueries(queryClient, predicate);

      if (queryClient.getQueryState(["tournaments", id])) {
        queryClient.setQueryData(["tournaments", id], null);
      }
      updateOptimisticQueries(queryClient, predicate, (data, queryKey) => {
        if (queryKey.length === 1 && queryKeyStartsWith(queryKey, ["tournaments"])) {
          return removeArrayItemById(data, id);
        }
        if (queryKeyStartsWith(queryKey, ["tournaments", id, "teams"])) {
          return [];
        }
        if (queryKeyStartsWith(queryKey, ["/api/matches"])) {
          if (!Array.isArray(data)) return data;
          return data.filter(
            (match) =>
              typeof match === "object" &&
              match !== null &&
              !("tournamentId" in match && match.tournamentId === id),
          );
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

function tournamentPredicate(tournamentId: number): QueryKeyPredicate {
  return (queryKey) =>
    queryKeyStartsWith(queryKey, ["tournaments"]) ||
    queryKeyStartsWith(queryKey, ["/api/matches"]);
}

export function useAddTeamToTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tournamentId,
      teamId,
      twitchChannel,
    }: {
      tournamentId: number;
      teamId: number;
      twitchChannel?: string | null;
    }) => {
      const res = await apiFetch(`/api/tournaments/${tournamentId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, twitchChannel }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to add team to tournament");
      }
      return res.json();
    },
    onSuccess: () => refreshAppData(queryClient),
  });
}

export function useCreateTournamentTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tournamentId,
      team,
      twitchChannel,
    }: {
      tournamentId: number;
      team: InsertTeam;
      twitchChannel?: string | null;
    }) => {
      const res = await apiFetch(`/api/tournaments/${tournamentId}/teams/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...team, twitchChannel }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create tournament team");
      }
      return res.json() as Promise<TournamentTeamWithMeta>;
    },
    onSuccess: () => refreshAppData(queryClient),
  });
}

export type TournamentTeamsImportResult = {
  created: TournamentTeamWithMeta[];
  enrolledExisting: TournamentTeamWithMeta[];
  skipped: Array<{ row: number; name: string; reason: string }>;
};

export function useImportTournamentTeams() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tournamentId,
      teams,
    }: {
      tournamentId: number;
      teams: Array<{
        name: string;
        color?: string;
        twitchChannel?: string | null;
      }>;
    }) => {
      const res = await apiFetch(`/api/tournaments/${tournamentId}/teams/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to import tournament teams");
      }
      return res.json() as Promise<TournamentTeamsImportResult>;
    },
    onSuccess: () => refreshAppData(queryClient),
  });
}

export function useGenerateTournamentMatches() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tournamentId,
      startAt,
      startDate,
      startTime,
      timeZone,
      intervalDays,
      location,
    }: {
      tournamentId: number;
      startAt?: string;
      startDate?: string;
      startTime?: string;
      timeZone?: string;
      intervalDays: number;
      location?: string | null;
    }) => {
      const res = await apiFetch(`/api/tournaments/${tournamentId}/matches/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt,
          startDate,
          startTime,
          timeZone,
          intervalDays,
          location,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to generate tournament matches");
      }
      return res.json() as Promise<{ rounds: number; matches: unknown[] }>;
    },
    onSuccess: () => refreshAppData(queryClient),
  });
}

export function useRemoveTeamFromTournament() {
  const queryClient = useQueryClient();
  return useMutation<
    unknown,
    Error,
    { tournamentId: number; teamId: number },
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
    mutationFn: async ({ tournamentId, teamId }: { tournamentId: number; teamId: number }) => {
      const res = await apiFetch(`/api/tournaments/${tournamentId}/teams/${teamId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to remove team from tournament");
      }
      return res.json();
    },
    onMutate: async ({ tournamentId, teamId }) => {
      const predicate: QueryKeyPredicate = (queryKey) =>
        queryKeyStartsWith(queryKey, ["tournaments", tournamentId, "teams"]) ||
        queryKeyStartsWith(queryKey, ["/api/teams"]) ||
        queryKeyStartsWith(queryKey, ["/api/matches"]);
      const snapshot = await snapshotOptimisticQueries(queryClient, predicate);

      updateOptimisticQueries(queryClient, predicate, (data, queryKey) => {
        if (queryKeyStartsWith(queryKey, ["tournaments", tournamentId, "teams"])) {
          return removeArrayItemById(data, teamId);
        }
        if (queryKeyStartsWith(queryKey, ["/api/matches"])) {
          if (!Array.isArray(data)) return data;
          return data.filter(
            (match) =>
              typeof match === "object" &&
              match !== null &&
              !(
                "tournamentId" in match &&
                "homeTeamId" in match &&
                "awayTeamId" in match &&
                match.tournamentId === tournamentId &&
                (match.homeTeamId === teamId || match.awayTeamId === teamId)
              ),
          );
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

export function useTournamentTeams(tournamentId: number) {
  return useQuery({
    queryKey: ["tournaments", tournamentId, "teams"],
    queryFn: async () => {
      const res = await apiFetch(`/api/tournaments/${tournamentId}/teams`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tournament teams");
      return res.json() as Promise<TournamentTeamWithMeta[]>;
    },
    enabled: !!tournamentId,
  });
}
export type TournamentTeamWithMeta = Team & {
  tournamentId: number;
  twitchChannel: string | null;
};
