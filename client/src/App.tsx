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
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={() => <ProtectedRoute component={Home} />} />
      <Route path="/teams" component={() => <ProtectedRoute component={Teams} />} />
      <Route path="/teams/:id" component={() => <ProtectedRoute component={TeamDetails} />} />
      <Route path="/matches" component={() => <ProtectedRoute component={Matches} />} />
      <Route path="/matches/new" component={() => <ProtectedRoute component={CreateMatch} />} />
      <Route path="/matches/:id" component={() => <ProtectedRoute component={MatchDetails} />} />
      <Route path="/tournaments" component={() => <ProtectedRoute component={Tournaments} />} />
      <Route path="/tournaments/new" component={() => <ProtectedRoute component={CreateTournament} />} />
      <Route path="/tournaments/:id" component={({ params }) => <ProtectedRoute component={() => <TournamentDetails tournamentId={Number(params.id)} />} />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} requiredRole="admin" />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
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
