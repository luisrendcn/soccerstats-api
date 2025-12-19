import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Teams from "@/pages/Teams";
import TeamDetails from "@/pages/TeamDetails";
import Matches from "@/pages/Matches";
import MatchDetails from "@/pages/MatchDetails";
import CreateMatch from "@/pages/CreateMatch";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/teams" component={Teams} />
      <Route path="/teams/:id" component={TeamDetails} />
      <Route path="/matches" component={Matches} />
      <Route path="/matches/new" component={CreateMatch} />
      <Route path="/matches/:id" component={MatchDetails} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
