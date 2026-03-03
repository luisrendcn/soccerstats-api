import { useState } from "react";
import { useRoute } from "wouter";
import { useMatch, useUpdateMatch, useCreateGoal, useMatchGoals } from "@/hooks/use-matches";
import { useTeam, useTeamPlayers } from "@/hooks/use-teams";
import { Layout } from "@/components/Layout";
import { TeamColorCircleLarge } from "@/components/TeamColor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Clock, MapPin, Trophy, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export default function MatchDetails() {
  const [matchRoute, params] = useRoute("/matches/:id");
  const matchId = params ? parseInt(params.id) : 0;
  
  const { data: match, isLoading: matchLoading } = useMatch(matchId);
  const { data: goals, isLoading: goalsLoading } = useMatchGoals(matchId);
  
  const { data: homeTeam } = useTeam(match?.homeTeamId || 0);
  const { data: awayTeam } = useTeam(match?.awayTeamId || 0);
  
  const { data: homePlayersResp } = useTeamPlayers(match?.homeTeamId || 0);
  const { data: awayPlayersResp } = useTeamPlayers(match?.awayTeamId || 0);
  const homePlayers = homePlayersResp;
  const awayPlayers = awayPlayersResp;

  const updateMatch = useUpdateMatch();
  const createGoal = useCreateGoal();
  const { toast } = useToast();
  const { data: auth } = useAuth();
  const canModifyMatch = auth?.userRole === 'admin' || auth?.userRole === 'tournament_manager' || auth?.userRole === 'referee';
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("unknown");
  const [goalMinute, setGoalMinute] = useState("");
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const isLoading = matchLoading || goalsLoading || !match || !homeTeam || !awayTeam;
  const isFinished = match?.status === "finished";

  const handleFinishMatch = async () => {
    if (!match) return;
    try {
      await updateMatch.mutateAsync({ id: match.id, status: "finished" });
      toast({ title: "Match Finished", description: "Final score has been recorded." });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to finish match" });
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId || !goalMinute) return;

    try {
      // 1. Create the goal record
      await createGoal.mutateAsync({
        matchId,
        teamId: parseInt(selectedTeamId),
        playerId: selectedPlayerId === "unknown" ? undefined : parseInt(selectedPlayerId),
        minute: parseInt(goalMinute)
      });

      // 2. Update the match score
      const isHome = parseInt(selectedTeamId) === match?.homeTeamId;
      await updateMatch.mutateAsync({
        id: matchId,
        homeScore: isHome ? (match?.homeScore || 0) + 1 : match?.homeScore,
        awayScore: !isHome ? (match?.awayScore || 0) + 1 : match?.awayScore,
      });

      toast({ title: "GOAL!", description: "Score updated." });
      setIsGoalDialogOpen(false);
      setGoalMinute("");
      setSelectedPlayerId("unknown");
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: (err as Error).message });
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <Layout title="Match Center">
      {/* Scoreboard */}
      <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden mb-8">
        <div className="bg-muted/30 p-3 text-center text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-border/50 flex justify-center items-center gap-2">
          {isFinished ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3 h-3"/> Final Score</span> : <span className="flex items-center gap-1 text-primary"><Clock className="w-3 h-3"/> Live Match</span>}
        </div>
        
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex-1 flex flex-col items-center gap-2">
              <TeamColorCircleLarge color={homeTeam.color}>
                {homeTeam.name.substring(0, 1)}
              </TeamColorCircleLarge>
              <h3 className="font-display font-bold text-center leading-tight">{homeTeam.name}</h3>
            </div>

            <div className="px-6 flex flex-col items-center">
              <div className="text-4xl font-mono font-bold tracking-tight bg-muted/20 px-4 py-2 rounded-lg">
                {match.homeScore} - {match.awayScore}
              </div>
              <div className="mt-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {format(new Date(match.date), "HH:mm")}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center gap-2">
              <TeamColorCircleLarge color={awayTeam.color}>
                {awayTeam.name.substring(0, 1)}
              </TeamColorCircleLarge>
              <h3 className="font-display font-bold text-center leading-tight">{awayTeam.name}</h3>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{match.location || "Main Stadium"}</span>
          </div>
        </div>

        {/* Actions */}
        {!isFinished && (
          <div className="p-4 bg-muted/10 border-t border-border grid grid-cols-2 gap-3">
            {canModifyMatch && (
              <>
              <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full font-bold shadow-sm" variant="default">
                  <Trophy className="w-4 h-4 mr-2" /> Add Goal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Goal</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddGoal} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Scoring Team</Label>
                    <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={String(homeTeam.id)}>{homeTeam.name}</SelectItem>
                        <SelectItem value={String(awayTeam.id)}>{awayTeam.name}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Scorer (Optional)</Label>
                    <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Player" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Unknown Player</SelectItem>
                        {selectedTeamId === String(homeTeam.id) && homePlayers?.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name} #{p.number}</SelectItem>
                        ))}
                        {selectedTeamId === String(awayTeam.id) && awayPlayers?.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name} #{p.number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Minute</Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 45" 
                      value={goalMinute}
                      onChange={e => setGoalMinute(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={createGoal.isPending}>
                    Confirm Goal
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

              <Button variant="outline" className="w-full" onClick={handleFinishMatch} disabled={updateMatch.isPending}>
                End Match
              </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Match Events */}
      <div className="space-y-4">
        <h3 className="font-display text-lg px-2">Match Events</h3>
        <div className="space-y-3">
          {goals?.sort((a, b) => (b.minute || 0) - (a.minute || 0)).map((goal) => {
            const isHomeGoal = goal.teamId === homeTeam.id;
            const player = [...(homePlayers || []), ...(awayPlayers || [])].find(p => p.id === goal.playerId);
            
            return (
              <div key={goal.id} className={cn("flex items-center gap-4 animate-in slide-in-from-bottom-2", isHomeGoal ? "flex-row" : "flex-row-reverse")}>
                <div className="w-12 text-center font-mono font-bold text-muted-foreground text-sm">
                  {goal.minute}'
                </div>
                <div className={cn(
                  "flex-1 p-3 rounded-xl border border-border flex items-center gap-3 shadow-sm",
                  isHomeGoal ? "bg-primary/5 border-primary/20" : "bg-card"
                )}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-background border border-border shadow-sm text-xs font-bold">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{player?.name || "Unknown Player"}</p>
                    <p className="text-xs text-muted-foreground">{isHomeGoal ? homeTeam.name : awayTeam.name}</p>
                  </div>
                </div>
              </div>
            );
          })}
          
          {goals?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm italic">
              No goals recorded yet.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
