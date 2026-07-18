import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RegistrationRequest, User } from "@shared/schema";
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

export interface SafeUser extends Omit<User, "password"> {}
export interface SafeRegistrationRequest
  extends Omit<RegistrationRequest, "password"> {}

export type ReviewRegistrationResult =
  | SafeUser
  | SafeRegistrationRequest;

type UserUpdateInput = {
  id: number;
  name?: string;
  email?: string;
  role?: string;
  teamId?: number | null;
  isActive?: boolean;
};

const usersPredicate: QueryKeyPredicate = (queryKey) =>
  queryKeyStartsWith(queryKey, ["admin", "users"]);

const adminPredicate: QueryKeyPredicate = (queryKey) =>
  usersPredicate(queryKey) ||
  queryKeyStartsWith(queryKey, ["admin", "registration-requests"]);

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
  return useMutation<
    ReviewRegistrationResult,
    Error,
    number,
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
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
    onMutate: async (id) => {
      const snapshot = await snapshotOptimisticQueries(
        queryClient,
        adminPredicate,
      );

      updateOptimisticQueries(queryClient, adminPredicate, (data, queryKey) => {
        if (queryKeyStartsWith(queryKey, ["admin", "registration-requests"])) {
          return removeArrayItemById(data, id);
        }
        return data;
      });

      return { snapshot, predicate: adminPredicate };
    },
    onError: (_error, _id, context) => {
      restoreOptimisticQueries(queryClient, context?.snapshot);
    },
    onSuccess: (result) => {
      if (action === "approve" && "role" in result) {
        updateOptimisticQueries(queryClient, usersPredicate, (data) =>
          prependUniqueArrayItem(data, result),
        );
      }
    },
    onSettled: (_data, _error, _id, context) => {
      if (context) {
        void invalidateOptimisticQueries(queryClient, context.predicate);
      }
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
      teamId?: number | null;
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
    onSuccess: (user) => {
      updateOptimisticQueries(queryClient, usersPredicate, (data) =>
        prependUniqueArrayItem(data, user),
      );
      void invalidateOptimisticQueries(queryClient, usersPredicate);
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation<
    SafeUser,
    Error,
    UserUpdateInput,
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
    mutationFn: async ({ id, ...data }) => {
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
    onMutate: async ({ id, ...data }) => {
      const snapshot = await snapshotOptimisticQueries(
        queryClient,
        usersPredicate,
      );

      updateOptimisticQueries(queryClient, usersPredicate, (current) =>
        patchArrayItemById(current, id, data),
      );

      return { snapshot, predicate: usersPredicate };
    },
    onError: (_error, _variables, context) => {
      restoreOptimisticQueries(queryClient, context?.snapshot);
    },
    onSuccess: (user) => {
      updateOptimisticQueries(queryClient, usersPredicate, (data) =>
        replaceArrayItemById(data, user),
      );
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context) {
        void invalidateOptimisticQueries(queryClient, context.predicate);
      }
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation<
    SafeUser,
    Error,
    { id: number; role: string },
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
    mutationFn: async ({ id, role }) => {
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
    onMutate: async ({ id, role }) => {
      const snapshot = await snapshotOptimisticQueries(
        queryClient,
        usersPredicate,
      );

      updateOptimisticQueries(queryClient, usersPredicate, (data) =>
        patchArrayItemById(data, id, { role }),
      );

      return { snapshot, predicate: usersPredicate };
    },
    onError: (_error, _variables, context) => {
      restoreOptimisticQueries(queryClient, context?.snapshot);
    },
    onSuccess: (user) => {
      updateOptimisticQueries(queryClient, usersPredicate, (data) =>
        replaceArrayItemById(data, user),
      );
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context) {
        void invalidateOptimisticQueries(queryClient, context.predicate);
      }
    },
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation<
    SafeUser,
    Error,
    { id: number; isActive: boolean },
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
    mutationFn: async ({ id, isActive }) => {
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
    onMutate: async ({ id, isActive }) => {
      const snapshot = await snapshotOptimisticQueries(
        queryClient,
        usersPredicate,
      );

      updateOptimisticQueries(queryClient, usersPredicate, (data) =>
        patchArrayItemById(data, id, { isActive }),
      );

      return { snapshot, predicate: usersPredicate };
    },
    onError: (_error, _variables, context) => {
      restoreOptimisticQueries(queryClient, context?.snapshot);
    },
    onSuccess: (user) => {
      updateOptimisticQueries(queryClient, usersPredicate, (data) =>
        replaceArrayItemById(data, user),
      );
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context) {
        void invalidateOptimisticQueries(queryClient, context.predicate);
      }
    },
  });
}

export function useDeleteUserPermanently() {
  const queryClient = useQueryClient();
  return useMutation<
    { success: boolean },
    Error,
    number,
    { snapshot: OptimisticSnapshot; predicate: QueryKeyPredicate }
  >({
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
    onMutate: async (id) => {
      const snapshot = await snapshotOptimisticQueries(
        queryClient,
        adminPredicate,
      );
      const users = queryClient.getQueryData<SafeUser[]>(["admin", "users"]);
      const deletedEmail = users?.find((user) => user.id === id)?.email;

      updateOptimisticQueries(queryClient, adminPredicate, (data, queryKey) => {
        if (queryKeyStartsWith(queryKey, ["admin", "users"])) {
          return removeArrayItemById(data, id);
        }
        if (
          deletedEmail &&
          queryKeyStartsWith(queryKey, ["admin", "registration-requests"]) &&
          Array.isArray(data)
        ) {
          return data.filter(
            (request) =>
              typeof request !== "object" ||
              request === null ||
              !("email" in request) ||
              request.email !== deletedEmail,
          );
        }
        return data;
      });

      return { snapshot, predicate: adminPredicate };
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
