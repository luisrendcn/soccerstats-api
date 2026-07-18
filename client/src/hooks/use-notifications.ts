import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppNotification } from "@shared/schema";
import { apiFetch } from "@/lib/api";

const notificationsKey = ["notifications"] as const;

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        includeRead: "true",
        limit: "30",
      });
      const res = await apiFetch(`/api/notifications?${params.toString()}`, {
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) return [];
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json() as Promise<AppNotification[]>;
    },
    enabled,
    refetchInterval: enabled ? 20_000 : false,
    retry: false,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark notification as read");
      return res.json() as Promise<AppNotification>;
    },
    onSuccess: (notification) => {
      queryClient.setQueryData<AppNotification[]>(notificationsKey, (current) =>
        current?.map((item) =>
          item.id === notification.id ? notification : item,
        ),
      );
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark notifications as read");
      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      queryClient.setQueryData<AppNotification[]>(notificationsKey, (current) =>
        current?.map((item) => ({
          ...item,
          readAt: item.readAt || new Date(),
        })),
      );
    },
  });
}

export function useNativeNotificationBridge(
  notifications: AppNotification[] | undefined,
) {
  useEffect(() => {
    if (typeof window === "undefined" || !notifications?.length) return;
    if (localStorage.getItem("notifications") !== "true") return;
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const storageKey = "shown-notification-ids";
    const shown = new Set(
      JSON.parse(localStorage.getItem(storageKey) || "[]") as number[],
    );
    const unread = notifications.filter((item) => !item.readAt);
    const next = unread.filter((item) => !shown.has(item.id));

    for (const notification of next) {
      new Notification(notification.title, {
        body: notification.body,
        tag: `soccer-stats-${notification.id}`,
      });
      shown.add(notification.id);
    }

    if (next.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify([...shown].slice(-100)));
    }
  }, [notifications]);
}
