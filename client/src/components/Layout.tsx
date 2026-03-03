import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { LanguageSelector } from "./LanguageSelector";
import { UserProfile } from "./UserProfile";
import { ArrowLeft } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  header?: ReactNode;
  title?: string;
  showBack?: boolean;
}

export function Layout({ children, header, title, showBack }: LayoutProps) {
  return (
    <div className="min-h-screen bg-muted/10 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                title="Go back"
                className="p-2 rounded-full hover:bg-muted/20"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {header ? header : (
              <h1 className="text-xl font-display font-bold tracking-tight text-foreground">
                {title || "League App"}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2">
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
