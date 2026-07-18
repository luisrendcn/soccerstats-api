import { Link } from "wouter";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useClearNotificationPanel,
  useNativeNotificationBridge,
  useNotifications,
  useLocalMatchReminderScheduler,
  useUpcomingNotifications,
} from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n.tsx";

function formatNotificationDate(value: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString();
}

export function NotificationBell() {
  const { t } = useLanguage();
  const { data: auth } = useAuth();
  const enabled = Boolean(auth?.userId);
  const { data: notifications = [] } = useNotifications(enabled);
  const { data: upcomingNotifications = [] } = useUpcomingNotifications(enabled);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const clearPanel = useClearNotificationPanel();
  useNativeNotificationBridge(notifications);
  useLocalMatchReminderScheduler(upcomingNotifications, enabled);

  if (!enabled) return null;

  const unread = notifications.filter((notification) => !notification.readAt);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title={t("notifications")}
          className="relative rounded-full p-2 hover:bg-muted/20"
        >
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-sm p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="font-semibold">{t("notifications")}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t("markAllRead")}
              disabled={!unread.length || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title={t("clearNotifications")}
              disabled={!notifications.length || clearPanel.isPending}
              onClick={() => clearPanel.mutate()}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-96 max-h-[70vh]">
          <div className="divide-y divide-border">
            {notifications.length ? (
              notifications.map((notification) => {
                const content = (
                  <div
                    className={cn(
                      "block w-full px-3 py-3 text-left transition-colors hover:bg-muted/40",
                      !notification.readAt && "bg-primary/5",
                    )}
                    onClick={() => {
                      if (!notification.readAt) markRead.mutate(notification.id);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1 h-2 w-2 rounded-full",
                          notification.readAt ? "bg-muted" : "bg-primary",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight">
                          {notification.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {notification.body}
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {formatNotificationDate(notification.scheduledAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );

                return notification.link ? (
                  <Link key={notification.id} href={notification.link}>
                    {content}
                  </Link>
                ) : (
                  <button key={notification.id} className="w-full">
                    {content}
                  </button>
                );
              })
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t("noNotifications")}
              </p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
