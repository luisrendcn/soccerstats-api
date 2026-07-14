import { useState } from "react";
import { useRoute } from "wouter";
import { useTeam, useTeamPlayers, useCreatePlayer, useImportTeamPlayers, useDeletePlayer } from "@/hooks/use-teams";
import { Layout } from "@/components/Layout";
import { TeamColorCircleSmall } from "@/components/TeamColor";
import { FileUp, Gamepad2, Loader2, Radio, UserPlus, Shirt, Trash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n.tsx";
import { parsePlayerImportFile } from "@/lib/spreadsheet-import";

export default function TeamDetails() {
  const [match, params] = useRoute("/teams/:id");
  const teamId = params ? parseInt(params.id) : 0;
  
  const { data: team, isLoading: teamLoading } = useTeam(teamId);
  const isVideogameTeam = team?.isVideogameTournamentTeam === true;
  const { data: playersResp, isLoading: playersLoading } = useTeamPlayers(
    teamId,
    1,
    10,
    "",
    { enabled: !!teamId && !isVideogameTeam },
  );
  const players = playersResp;
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const createPlayer = useCreatePlayer();
  const importPlayers = useImportTeamPlayers();
  const deletePlayer = useDeletePlayer();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [playersFile, setPlayersFile] = useState<File | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [playerNumber, setPlayerNumber] = useState("");
  const { data: auth } = useAuth();
  const isTeamOwner = (auth?.userRole === 'team_captain' || auth?.userRole === 'team') && auth?.teamId === teamId;
  const canManagePlayers = !isVideogameTeam && (auth?.userRole === 'admin' || auth?.userRole === 'tournament_manager' || isTeamOwner);
  const canDeletePlayers = !isVideogameTeam && (auth?.userRole === "admin" || isTeamOwner);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName || !teamId) return;

    try {
      await createPlayer.mutateAsync({ 
        name: playerName, 
        teamId, 
        number: playerNumber ? parseInt(playerNumber) : undefined 
      });
      toast({ title: t("playerAdded"), description: t("playerJoinedTeam", { name: playerName }) });
      setPlayerName("");
      setPlayerNumber("");
      setIsDialogOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: t("error"), description: t("unexpectedError") });
    }
  };

  const handleImportPlayers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playersFile) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("chooseExcelFile"),
      });
      return;
    }

    try {
      const importedPlayers = await parsePlayerImportFile(playersFile);
      if (importedPlayers.length === 0) {
        toast({
          variant: "destructive",
          title: t("error"),
          description: t("noRowsFound"),
        });
        return;
      }
      const result = await importPlayers.mutateAsync({
        teamId,
        players: importedPlayers,
      });
      toast({
        title: t("playersImported"),
        description: t("playersImportedDescription", {
          count: result.created.length,
          skipped: result.skipped.length,
        }),
      });
      setPlayersFile(null);
      setIsImportDialogOpen(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: err instanceof Error ? err.message : t("unexpectedError"),
      });
    }
  };

  if (teamLoading || (!isVideogameTeam && playersLoading)) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
  if (!team) return <div>{t("teamNotFound")}</div>;

  return (
    <Layout title={team.name} header={
      <div className="flex items-center gap-3">
        <TeamColorCircleSmall color={team.color} />
        <h1 className="text-xl font-display font-bold tracking-tight text-foreground">{team.name}</h1>
      </div>
    }>
      {isVideogameTeam ? (
        <div className="space-y-4">
          <Card className="border-primary/20 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <Gamepad2 className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-3">
                <Badge className="bg-primary/10 text-primary">
                  {t("videogameTournament")}
                </Badge>
                <div>
                  <h2 className="font-display text-lg font-bold">
                    {t("videogameTeamProfileTitle")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("videogameTeamProfileDescription")}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-3">
            {team.videogameTournaments?.map((tournament) => (
              <Card key={tournament.tournamentId} className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t("tournament")}
                </p>
                <h3 className="mt-1 font-semibold">{tournament.tournamentName}</h3>
                {tournament.twitchChannel && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Radio className="h-4 w-4 text-primary" />
                    Twitch: @{tournament.twitchChannel}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      ) : (
      <div className="space-y-6">
        {/* Roster Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display">{t("activeRoster")}</h2>
          
          {canManagePlayers && (
            <div className="flex flex-wrap gap-2">
              <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2 rounded-full">
                    <FileUp className="w-4 h-4" /> {t("importPlayers")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("importPlayersFromExcel")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleImportPlayers} className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      {t("excelPlayerFormatHint")}
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="players-excel">{t("chooseExcelFile")}</Label>
                      <Input
                        id="players-excel"
                        type="file"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={(event) =>
                          setPlayersFile(event.target.files?.[0] || null)
                        }
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={importPlayers.isPending || !playersFile}
                    >
                      {importPlayers.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t("importing")}
                        </>
                      ) : (
                        t("importPlayers")
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2 rounded-full">
                    <UserPlus className="w-4 h-4" /> {t("addPlayer")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("addPlayerToTeam", { team: team.name })}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddPlayer} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("playerName")}</Label>
                      <Input 
                        id="name" 
                        value={playerName} 
                        onChange={(e) => setPlayerName(e.target.value)} 
                        placeholder="Lionel Messi"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="number">{t("jerseyNumberOptional")}</Label>
                      <Input 
                        id="number" 
                        type="number"
                        value={playerNumber} 
                        onChange={(e) => setPlayerNumber(e.target.value)} 
                        placeholder="10"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={createPlayer.isPending}>
                      {createPlayer.isPending ? t("adding") : t("addPlayer")}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
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
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("forward")}</p>
              </div>
              {canDeletePlayers && (
                <button title={t("removePlayerConfirm", { name: player.name })} className="absolute top-2 right-2 p-1 rounded-md bg-red-50 hover:bg-red-100" onClick={async () => {
                  if (!confirm(t("removePlayerConfirm", { name: player.name }))) return;
                  try {
                    await deletePlayer.mutateAsync({ id: player.id, teamId });
                  } catch {
                    toast({
                      variant: "destructive",
                      title: t("error"),
                      description: t("removePlayerFailed"),
                    });
                  }
                }}>
                  <Trash className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          ))}

          {players?.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted/10">
              <Shirt className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground">{t("noPlayersOnRoster")}</p>
            </div>
          )}
        </div>
      </div>
      )}
    </Layout>
  );
}
