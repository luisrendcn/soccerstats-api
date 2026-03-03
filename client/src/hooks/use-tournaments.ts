import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tournament, CreateTournamentInput, UpdateTournamentInput, Team } from "@shared/schema";
import { apiFetch } from "@/lib/api";

export function useTournaments() {
  return useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const res = await apiFetch("/api/tournaments", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tournaments");
      return res.json() as Promise<Tournament[]>;
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
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
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["tournaments", id] });
    },
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
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["tournaments", id] });
    },
  });
}

export function useAddTeamToTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tournamentId, teamId }: { tournamentId: number; teamId: number }) => {
      const res = await apiFetch(`/api/tournaments/${tournamentId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to add team to tournament");
      }
      return res.json();
    },
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ["tournaments", tournamentId, "teams"] });
    },
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
    onSuccess: (_, { tournamentId }) => {
      queryClient.invalidateQueries({ queryKey: ["tournaments", tournamentId, "teams"] });
    },
  });
}

export function useTournamentTeams(tournamentId: number) {
  return useQuery({
    queryKey: ["tournaments", tournamentId, "teams"],
    queryFn: async () => {
      const res = await apiFetch(`/api/tournaments/${tournamentId}/teams`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tournament teams");
      return res.json() as Promise<Team[]>;
    },
    enabled: !!tournamentId,
  });
}
