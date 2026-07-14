import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tournament, CreateTournamentInput, UpdateTournamentInput, Team, InsertTeam } from "@shared/schema";
import { apiFetch } from "@/lib/api";
import { refreshAppData } from "@/lib/queryClient";
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
      if (!res.ok) throw new Error("Failed to fetch tournament");
      return res.json() as Promise<Tournament>;
    },
    enabled: !!id,
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
  return useMutation({
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
    onSuccess: () => refreshAppData(queryClient),
  });
}

export function useDeleteTournament() {
  const queryClient = useQueryClient();
  return useMutation({
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
    onSuccess: () => refreshAppData(queryClient),
  });
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
      intervalDays,
      location,
    }: {
      tournamentId: number;
      startAt: string;
      intervalDays: number;
      location?: string | null;
    }) => {
      const res = await apiFetch(`/api/tournaments/${tournamentId}/matches/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt, intervalDays, location }),
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
  return useMutation({
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
    onSuccess: () => refreshAppData(queryClient),
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
