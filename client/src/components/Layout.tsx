import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface LayoutProps {
  children: ReactNode;
  header?: ReactNode;
  title?: string;
  showBack?: boolean;
}

export function Layout({ children, header, title }: LayoutProps) {
  return (
    <div className="min-h-screen bg-muted/10 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {header ? header : (
            <h1 className="text-xl font-display font-bold tracking-tight text-foreground">
              {title || "League App"}
            </h1>
          )}
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
