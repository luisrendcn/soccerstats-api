import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertTeam, type InsertPlayer } from "@shared/routes";

export function useTeams() {
  return useQuery({
    queryKey: [api.teams.list.path],
    queryFn: async () => {
      const res = await fetch(api.teams.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch teams');
      return api.teams.list.responses[200].parse(await res.json());
    },
  });
}

export function useTeam(id: number) {
  return useQuery({
    queryKey: [api.teams.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.teams.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
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
      const res = await fetch(api.teams.create.path, {
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.teams.list.path] }),
  });
}

export function useTeamPlayers(teamId: number) {
  return useQuery({
    queryKey: [api.players.list.path, teamId],
    queryFn: async () => {
      const url = buildUrl(api.players.list.path, { teamId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch players');
      return api.players.list.responses[200].parse(await res.json());
    },
    enabled: !!teamId,
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertPlayer) => {
      const validated = api.players.create.input.parse(data);
      const res = await fetch(api.players.create.path, {
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
    onSuccess: (_, variables) => queryClient.invalidateQueries({ 
      queryKey: [api.players.list.path, variables.teamId] 
    }),
  });
}
