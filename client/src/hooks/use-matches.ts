import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertMatch, type InsertGoal } from "@shared/routes";

export function useMatches() {
  return useQuery({
    queryKey: [api.matches.list.path],
    queryFn: async () => {
      const res = await fetch(api.matches.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch matches');
      return api.matches.list.responses[200].parse(await res.json());
    },
  });
}

export function useMatch(id: number) {
  return useQuery({
    queryKey: [api.matches.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.matches.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
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
      
      const res = await fetch(api.matches.create.path, {
        method: api.matches.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: "include",
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.matches.list.path] }),
  });
}

export function useUpdateMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertMatch>) => {
      const url = buildUrl(api.matches.update.path, { id });
      const res = await fetch(url, {
        method: api.matches.update.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to update match');
      return api.matches.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.matches.list.path] });
    },
  });
}

export function useMatchGoals(matchId: number) {
  return useQuery({
    queryKey: [api.goals.list.path, matchId],
    queryFn: async () => {
      const url = buildUrl(api.goals.list.path, { matchId });
      const res = await fetch(url, { credentials: "include" });
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
      const res = await fetch(api.goals.create.path, {
        method: api.goals.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to add goal');
      return api.goals.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.goals.list.path, variables.matchId] });
      queryClient.invalidateQueries({ queryKey: [api.matches.get.path, variables.matchId] });
      queryClient.invalidateQueries({ queryKey: [api.matches.list.path] });
    },
  });
}
