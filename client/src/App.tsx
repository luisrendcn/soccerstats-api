import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n.tsx";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppUpdatePrompt } from "@/components/AppUpdatePrompt";
import { Loader2 } from "lucide-react";

const NotFound = lazy(() => import("@/pages/not-found"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const Home = lazy(() => import("@/pages/Home"));
const Teams = lazy(() => import("@/pages/Teams"));
const TeamDetails = lazy(() => import("@/pages/TeamDetails"));
const MatchDetails = lazy(() => import("@/pages/MatchDetails"));
const CreateMatch = lazy(() => import("@/pages/CreateMatch"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const Tournaments = lazy(() => import("@/pages/Tournaments"));
const CreateTournament = lazy(() => import("@/pages/CreateTournament"));
const TournamentDetails = lazy(() => import("@/pages/TournamentDetails"));
const Settings = lazy(() => import("@/pages/Settings"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function RedirectToTournaments() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/tournaments");
  }, [setLocation]);
  return <RouteFallback />;
}

function Router() {
  const tournamentManagers = ["admin", "tournament_manager"];

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={() => <ProtectedRoute component={Home} allowPublic />} />
      <Route path="/teams" component={() => <ProtectedRoute component={Teams} allowPublic />} />
      <Route path="/teams/:id" component={() => <ProtectedRoute component={TeamDetails} allowPublic />} />
      <Route path="/matches" component={RedirectToTournaments} />
      <Route path="/matches/:id" component={() => <ProtectedRoute component={MatchDetails} allowPublic />} />
      <Route path="/tournaments" component={() => <ProtectedRoute component={Tournaments} allowPublic />} />
      <Route path="/tournaments/new" component={() => <ProtectedRoute component={CreateTournament} requiredRole={tournamentManagers} />} />
      <Route path="/tournaments/:id/matches/new" component={({ params }) => <ProtectedRoute component={() => <CreateMatch tournamentId={Number(params.id)} />} requiredRole={tournamentManagers} />} />
      <Route path="/tournaments/:id" component={({ params }) => <ProtectedRoute component={() => <TournamentDetails tournamentId={Number(params.id)} />} allowPublic />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} requiredRole={tournamentManagers} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} allowPublic />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <AppUpdatePrompt />
          <Suspense fallback={<RouteFallback />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
