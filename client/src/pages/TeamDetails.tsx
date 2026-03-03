import { useState } from "react";
import { useRoute } from "wouter";
import { useTeam, useTeamPlayers, useCreatePlayer } from "@/hooks/use-teams";
import { api } from "@shared/routes";
import { Layout } from "@/components/Layout";
import { TeamColorCircleSmall } from "@/components/TeamColor";
import { Loader2, UserPlus, Shirt, Trash } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

export default function TeamDetails() {
  const [match, params] = useRoute("/teams/:id");
  const teamId = params ? parseInt(params.id) : 0;
  
  const { data: team, isLoading: teamLoading } = useTeam(teamId);
  const { data: playersResp, isLoading: playersLoading } = useTeamPlayers(teamId);
  const players = playersResp;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createPlayer = useCreatePlayer();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [playerNumber, setPlayerNumber] = useState("");
  const { data: auth } = useAuth();
  const isPublic = auth?.userRole === 'public';
  const isTeamOwner = auth?.userRole === 'team' && auth?.teamId === teamId;
  const canManagePlayers = auth?.userRole === 'admin' || auth?.userRole === 'tournament_manager' || isTeamOwner;

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName || !teamId) return;

    try {
      await createPlayer.mutateAsync({ 
        name: playerName, 
        teamId, 
        number: playerNumber ? parseInt(playerNumber) : undefined 
      });
      toast({ title: "Player added!", description: `${playerName} joined the team.` });
      setPlayerName("");
      setPlayerNumber("");
      setIsDialogOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: (err as Error).message });
    }
  };

  if (teamLoading || playersLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
  if (!team) return <div>Team not found</div>;

  return (
    <Layout title={team.name} header={
      <div className="flex items-center gap-3">
        <TeamColorCircleSmall color={team.color} />
        <h1 className="text-xl font-display font-bold tracking-tight text-foreground">{team.name}</h1>
      </div>
    }>
      <div className="space-y-6">
        {/* Roster Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display">Active Roster</h2>
          
          {canManagePlayers && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 rounded-full">
                  <UserPlus className="w-4 h-4" /> Add Player
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Player to {team.name}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddPlayer} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Player Name</Label>
                    <Input 
                      id="name" 
                      value={playerName} 
                      onChange={(e) => setPlayerName(e.target.value)} 
                      placeholder="e.g. Lionel Messi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="number">Jersey Number (Optional)</Label>
                    <Input 
                      id="number" 
                      type="number"
                      value={playerNumber} 
                      onChange={(e) => setPlayerNumber(e.target.value)} 
                      placeholder="e.g. 10"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createPlayer.isPending}>
                    {createPlayer.isPending ? "Adding..." : "Add Player"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Players List */}
        <div className="grid grid-cols-1 gap-3">
          {players?.map((player: any) => (
            <div key={player.id} className="flex items-center bg-card p-4 rounded-xl border border-border shadow-sm relative">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mr-4 text-muted-foreground font-mono font-bold border border-border/50">
                {player.number || <Shirt className="w-5 h-5 opacity-50" />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-foreground">{player.name}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Forward</p>
              </div>
              {canManagePlayers && (
                <button title={`Remove player ${player.name}`} className="absolute top-2 right-2 p-1 rounded-md bg-red-50 hover:bg-red-100" onClick={async () => {
                  if (!confirm(`Remove player ${player.name}?`)) return;
                  await fetch(`/api/players/${player.id}`, { method: 'DELETE', credentials: 'include' });
                  // refetch players by invalidating query
                  queryClient.invalidateQueries({ queryKey: [api.players.list.path, teamId] });
                }}>
                  <Trash className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          ))}

          {players?.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted/10">
              <Shirt className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground">No players on roster yet.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
