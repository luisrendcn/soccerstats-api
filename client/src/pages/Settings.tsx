import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Switch } from "@/components/ui/switch";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useLanguage } from "@/lib/i18n.tsx";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  areAppNotificationsEnabled,
  cancelScheduledLocalReminders,
  requestAppNotificationPermission,
  setAppNotificationsEnabled,
} from "@/lib/native-notifications";

export default function Settings() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [dark, setDark] = useDarkMode();

  const [compact, setCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("compact") === "true";
  });
  useEffect(() => {
    if (compact) document.documentElement.classList.add("compact");
    else document.documentElement.classList.remove("compact");
    localStorage.setItem("compact", compact.toString());
  }, [compact]);

  const [notifications, setNotifications] = useState(() => {
    return areAppNotificationsEnabled();
  });
  useEffect(() => {
    setAppNotificationsEnabled(notifications);
  }, [notifications]);

  const handleNotificationsChange = async (enabled: boolean) => {
    if (!enabled) {
      setNotifications(false);
      void cancelScheduledLocalReminders();
      return;
    }

    const allowed = await requestAppNotificationPermission();
    if (!allowed) {
      toast({
        variant: "destructive",
        title: t("notifications"),
        description: t("notificationPermissionDenied"),
      });
      setNotifications(false);
      return;
    }

    setNotifications(true);
  };

  const handleReset = () => {
    setDark(false);
    setCompact(false);
    setNotifications(false);
    void cancelScheduledLocalReminders();
    localStorage.removeItem("theme");
    localStorage.removeItem("compact");
    setAppNotificationsEnabled(false);
  };

  return (
    <Layout title={t("settings") as string} showBack>
      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-medium mb-2">{t("appearance")}</h2>
          <div className="flex items-center justify-between">
            <span>{t("darkMode")}</span>
            <Switch checked={dark} onCheckedChange={setDark} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span>{t("compactMode")}</span>
            <Switch checked={compact} onCheckedChange={setCompact} />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium mb-2">{t("language")}</h2>
          <LanguageSelector />
        </section>

        <section>
          <h2 className="text-lg font-medium mb-2">{t("notifications")}</h2>
          <div className="flex items-center justify-between">
            <span>{t("enableNotifications")}</span>
            <Switch checked={notifications} onCheckedChange={handleNotificationsChange} />
          </div>
        </section>

        <section>
          <Button variant="destructive" onClick={handleReset}>
            {t("resetSettings")}
          </Button>
        </section>
      </div>
    </Layout>
  );
}
