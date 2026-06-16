import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RegistrationRequest, User } from "@shared/schema";
import { apiFetch } from "@/lib/api";

export interface SafeUser extends Omit<User, "password"> {}
export interface SafeRegistrationRequest
  extends Omit<RegistrationRequest, "password"> {}

export function useUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<SafeUser[]>;
    },
  });
}

export function useRegistrationRequests(enabled = true) {
  return useQuery({
    queryKey: ["admin", "registration-requests"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/registration-requests", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch registration requests");
      return res.json() as Promise<SafeRegistrationRequest[]>;
    },
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  });
}

function useReviewRegistrationRequest(action: "approve" | "reject") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(
        `/api/admin/registration-requests/${id}/${action}`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Failed to ${action} request`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "registration-requests"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useApproveRegistrationRequest() {
  return useReviewRegistrationRequest("approve");
}

export function useRejectRegistrationRequest() {
  return useReviewRegistrationRequest("reject");
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      email: string;
      name: string;
      password: string;
      role?: string;
      teamId?: number;
    }) => {
      const res = await apiFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create user");
      }
      return res.json() as Promise<SafeUser>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: number;
      name?: string;
      email?: string;
      role?: string;
      teamId?: number;
      isActive?: boolean;
    }) => {
      const res = await apiFetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update user");
      }
      return res.json() as Promise<SafeUser>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await apiFetch(`/api/admin/users/${id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update role");
      }
      return res.json() as Promise<SafeUser>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiFetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update user status");
      }
      return res.json() as Promise<SafeUser>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useDeleteUserPermanently() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/admin/users/${id}/permanent`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to permanently delete user");
      }
      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({
        queryKey: ["admin", "registration-requests"],
      });
    },
  });
}
