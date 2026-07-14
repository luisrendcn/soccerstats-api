import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, LoginInput, RegisterInput } from "@shared/schema";
import { apiFetch } from "@/lib/api";

export interface AuthResponse {
  id: number;
  email: string;
  name: string;
  role: string;
  teamId?: number | null;
}

export interface AuthStatus {
  userId: number;
  email: string;
  name: string;
  userRole: string;
  teamId?: number | null;
}

export interface RegistrationResponse {
  status: "pending";
  message: string;
}

export function useAuth() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await apiFetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) throw new Error("Failed to fetch auth status");
      return res.json() as Promise<AuthStatus>;
    },
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: LoginInput) => {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      if (!res.ok) {
        let message = "No se pudo iniciar sesión";
        try {
          const error = await res.json();
          message = error.message || message;
        } catch {
          message =
            res.status >= 500
              ? "El servidor no respondió correctamente. Intenta de nuevo."
              : message;
        }
        throw new Error(message);
      }
      return res.json() as Promise<AuthResponse>;
    },
    onSuccess: (user) => {
      // immediately seed auth cache
      queryClient.setQueryData(["auth", "me"], {
        userId: user.id,
        email: user.email,
        name: user.name,
        userRole: user.role,
        teamId: user.teamId ?? null,
      });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RegisterInput) => {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Registration failed");
      }
      return res.json() as Promise<RegistrationResponse>;
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Logout failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}
