import { Link, useLocation } from "wouter";
import { Trophy, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n.tsx";

const BASE_NAV_ITEMS = [
  { href: "/", labelKey: "home", icon: Trophy },
  { href: "/tournaments", labelKey: "tournaments", icon: Zap },
  { href: "/teams", labelKey: "teams", icon: Users },
] as const;

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useLanguage();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/50 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        {BASE_NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? location === item.href
              : location === item.href || location.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex flex-col items-center justify-center space-y-1 w-16 py-1 cursor-pointer transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <Icon className={cn("w-6 h-6", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium uppercase tracking-wider">{t(item.labelKey)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
