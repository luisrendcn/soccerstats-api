import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { AppNotification } from "@shared/schema";

const NOTIFICATIONS_SETTING_KEY = "notifications";
const SCHEDULED_LOCAL_IDS_KEY = "scheduled-local-notification-ids";

export function areAppNotificationsEnabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(NOTIFICATIONS_SETTING_KEY) !== "false";
}

export function setAppNotificationsEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATIONS_SETTING_KEY, enabled ? "true" : "false");
}

export async function requestAppNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    const requested = await LocalNotifications.requestPermissions();
    return requested.display === "granted";
  }

  if (typeof window !== "undefined" && "Notification" in window) {
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    return permission === "granted";
  }

  return true;
}

function readScheduledLocalIds() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SCHEDULED_LOCAL_IDS_KEY) || "[]") as number[];
  } catch {
    return [];
  }
}

function writeScheduledLocalIds(ids: number[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SCHEDULED_LOCAL_IDS_KEY, JSON.stringify(ids));
}

export async function cancelScheduledLocalReminders() {
  if (!Capacitor.isNativePlatform()) return;
  const ids = readScheduledLocalIds();
  if (ids.length === 0) return;

  await LocalNotifications.cancel({
    notifications: ids.map((id) => ({ id })),
  });
  writeScheduledLocalIds([]);
}

export async function scheduleLocalMatchReminders(
  notifications: AppNotification[],
) {
  if (!Capacitor.isNativePlatform()) return;
  if (!areAppNotificationsEnabled()) {
    await cancelScheduledLocalReminders();
    return;
  }

  const allowed = await requestAppNotificationPermission();
  if (!allowed) return;

  await cancelScheduledLocalReminders();

  const now = Date.now();
  const upcoming = notifications
    .filter((notification) => {
      const scheduledAt = new Date(notification.scheduledAt).getTime();
      return (
        notification.type === "match_reminder" &&
        !notification.readAt &&
        Number.isFinite(scheduledAt) &&
        scheduledAt > now
      );
    })
    .sort(
      (left, right) =>
        new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime(),
    )
    .slice(0, 50);

  if (upcoming.length === 0) return;

  await LocalNotifications.schedule({
    notifications: upcoming.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      schedule: {
        at: new Date(notification.scheduledAt),
        allowWhileIdle: true,
      },
      extra: {
        source: "soccer-stats",
        link: notification.link,
      },
    })),
  });

  writeScheduledLocalIds(upcoming.map((notification) => notification.id));
}
