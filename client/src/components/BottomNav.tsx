import { Link, useLocation } from "wouter";
import { Trophy, Calendar, Users, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "League", icon: Trophy },
    { href: "/matches", label: "Matches", icon: Calendar },
    { href: "/matches/new", label: "New", icon: PlusCircle, isAction: true },
    { href: "/teams", label: "Teams", icon: Users },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/50 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          if (item.isAction) {
            return (
              <Link key={item.href} href={item.href}>
                <div className="relative -top-5 bg-primary text-primary-foreground p-4 rounded-full shadow-lg shadow-primary/30 hover:scale-105 transition-transform cursor-pointer">
                  <Icon className="w-6 h-6" />
                </div>
              </Link>
            );
          }

          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex flex-col items-center justify-center space-y-1 w-16 py-1 cursor-pointer transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <Icon className={cn("w-6 h-6", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium uppercase tracking-wider">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
