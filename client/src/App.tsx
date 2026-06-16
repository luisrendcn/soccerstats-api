import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n.tsx";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Home from "@/pages/Home";
import Teams from "@/pages/Teams";
import TeamDetails from "@/pages/TeamDetails";
import Matches from "@/pages/Matches";
import MatchDetails from "@/pages/MatchDetails";
import CreateMatch from "@/pages/CreateMatch";
import AdminUsers from "@/pages/AdminUsers";
import Tournaments from "@/pages/Tournaments";
import CreateTournament from "@/pages/CreateTournament";
import TournamentDetails from "@/pages/TournamentDetails";
import Settings from "@/pages/Settings";

function Router() {
  const tournamentManagers = ["admin", "tournament_manager"];

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={() => <ProtectedRoute component={Home} allowPublic />} />
      <Route path="/teams" component={() => <ProtectedRoute component={Teams} allowPublic />} />
      <Route path="/teams/:id" component={() => <ProtectedRoute component={TeamDetails} allowPublic />} />
      <Route path="/matches" component={() => <ProtectedRoute component={Matches} allowPublic />} />
      <Route path="/matches/:id" component={() => <ProtectedRoute component={MatchDetails} allowPublic />} />
      <Route path="/tournaments" component={() => <ProtectedRoute component={Tournaments} allowPublic />} />
      <Route path="/tournaments/new" component={() => <ProtectedRoute component={CreateTournament} requiredRole={tournamentManagers} />} />
      <Route path="/tournaments/:id/matches/new" component={({ params }) => <ProtectedRoute component={() => <CreateMatch tournamentId={Number(params.id)} />} requiredRole={tournamentManagers} />} />
      <Route path="/tournaments/:id" component={({ params }) => <ProtectedRoute component={() => <TournamentDetails tournamentId={Number(params.id)} />} allowPublic />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} requiredRole="admin" />} />
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
          <Router />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
