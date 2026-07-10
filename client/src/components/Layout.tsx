import { ReactNode, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { BottomNav } from "./BottomNav";
import { LanguageSelector } from "./LanguageSelector";
import { UserProfile } from "./UserProfile";
import { refreshAppData } from "@/lib/queryClient";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n.tsx";

interface LayoutProps {
  children: ReactNode;
  header?: ReactNode;
  title?: string;
  showBack?: boolean;
}

export function Layout({ children, header, title, showBack }: LayoutProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const activeFetches = useIsFetching();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInProgress = isRefreshing || activeFetches > 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshAppData(queryClient);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/10 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                title={t("goBack")}
                className="p-2 rounded-full hover:bg-muted/20"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {header ? header : (
              <h1 className="text-xl font-display font-bold tracking-tight text-foreground">
                {title || t("leagueApp")}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              title={t("refreshData")}
              className="rounded-full p-2 hover:bg-muted/20 disabled:opacity-60"
              onClick={handleRefresh}
              disabled={refreshInProgress}
            >
              <RefreshCw
                className={cn("h-4 w-4", refreshInProgress && "animate-spin")}
              />
            </button>
            <LanguageSelector />
            <UserProfile />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
