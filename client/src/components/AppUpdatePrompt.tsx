import { useCallback, useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/lib/i18n.tsx";

type AppUpdateInfo = {
  latestVersionCode: number;
  latestVersionName: string;
  minimumSupportedVersionCode: number;
  updateUrl: string;
  releaseNotes?: string;
  forceUpdate?: boolean;
};

const dismissedKey = (versionCode: number) =>
  `soccerstats.dismissedUpdate.${versionCode}`;

export function AppUpdatePrompt() {
  const { t } = useLanguage();
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [currentVersionName, setCurrentVersionName] = useState("");

  const checkForUpdate = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    try {
      const appInfo = await App.getInfo();
      const currentVersionCode = Number(appInfo.build || 0);
      setCurrentVersionName(appInfo.version || "");

      const response = await apiFetch(
        `/api/app-update?platform=android&currentVersionCode=${currentVersionCode}`,
      );
      if (!response.ok) return;

      const payload = (await response.json()) as AppUpdateInfo;
      const isUpdateAvailable =
        Number(payload.latestVersionCode) > currentVersionCode &&
        !!payload.updateUrl;
      const wasDismissed =
        !payload.forceUpdate &&
        localStorage.getItem(dismissedKey(payload.latestVersionCode)) === "1";

      if (isUpdateAvailable && !wasDismissed) {
        setUpdateInfo(payload);
      }
    } catch {
      // Update checks should never interrupt app startup.
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) checkForUpdate();
    });

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, [checkForUpdate]);

  const dismissUpdate = () => {
    if (!updateInfo) return;
    localStorage.setItem(dismissedKey(updateInfo.latestVersionCode), "1");
    setUpdateInfo(null);
  };

  const openUpdate = async () => {
    if (!updateInfo) return;
    await Browser.open({ url: updateInfo.updateUrl });
  };

  return (
    <AlertDialog open={!!updateInfo}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("updateAvailableTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("updateAvailableDescription", {
              currentVersion: currentVersionName || t("unknown"),
              latestVersion: updateInfo?.latestVersionName || "",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {updateInfo?.releaseNotes && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            {updateInfo.releaseNotes}
          </div>
        )}

        <AlertDialogFooter>
          {!updateInfo?.forceUpdate && (
            <AlertDialogCancel onClick={dismissUpdate}>
              {t("updateLater")}
            </AlertDialogCancel>
          )}
          <AlertDialogAction onClick={openUpdate}>
            {t("updateNow")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

