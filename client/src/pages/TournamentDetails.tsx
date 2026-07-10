import {
  useTournament,
  useTournamentTeams,
  useAddTeamToTournament,
  useCreateTournamentTeam,
  useRemoveTeamFromTournament,
} from "@/hooks/use-tournaments";
import { useTeams } from "@/hooks/use-teams";
import { useLocation } from "wouter";
import { TeamColorCircleSmall } from "@/components/TeamColor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Plus, Trash2, Calendar, Gamepad2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StandingsTable from "@/components/ui/StandingTable";
import { useLanguage } from "@/lib/i18n.tsx";

interface TournamentDetailsProps {
  tournamentId: number;
}

const statusVariants: Record<string, any> = {
  draft: "secondary",
  active: "default",
  finished: "outline",
};

export default function TournamentDetails({ tournamentId }: TournamentDetailsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { data: auth } = useAuth();
  const isPublic = auth?.userRole === 'public';
  const canManageTournaments = auth?.userRole === 'admin' || auth?.userRole === 'tournament_manager';
  
  const { data: tournament, isLoading: tournamentLoading } = useTournament(tournamentId);
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: tournamentTeams, isLoading: tournamentTeamsLoading } = useTournamentTeams(tournamentId);
  
  const addTeam = useAddTeamToTournament();
  const createTeam = useCreateTournamentTeam();
  const removeTeam = useRemoveTeamFromTournament();
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [removingTeamId, setRemovingTeamId] = useState<number | null>(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#000000");
  const [newTeamTwitchChannel, setNewTeamTwitchChannel] = useState("");
  const [selectedTeamTwitchChannel, setSelectedTeamTwitchChannel] = useState("");
  const isVideogameTournament = tournament?.tournamentType === "videogame";

  const handleCreateTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTeamName.trim()) return;
    if (isVideogameTournament && !newTeamTwitchChannel.trim()) {
      toast({
        variant: "destructive",
        title: t("channelRequired"),
        description: t("twitchChannelRequiredDescription"),
      });
      return;
    }

    try {
      await createTeam.mutateAsync({
        tournamentId,
        team: {
          name: newTeamName.trim(),
          color: newTeamColor,
        },
        twitchChannel: newTeamTwitchChannel.trim() || null,
      });
      setNewTeamName("");
      setNewTeamColor("#000000");
      setNewTeamTwitchChannel("");
      setIsCreateTeamOpen(false);
      toast({ title: `✓ ${t("teamCreatedAndEnrolled")}` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
      });
    }
  };

  const handleAddTeam = async () => {
    if (!selectedTeamId) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("selectTeam"),
      });
      return;
    }
    if (isVideogameTournament && !selectedTeamTwitchChannel.trim()) {
      toast({
        variant: "destructive",
        title: t("channelRequired"),
        description: t("twitchChannelRequiredDescription"),
      });
      return;
    }

    try {
      await addTeam.mutateAsync({
        tournamentId,
        teamId: Number(selectedTeamId),
        twitchChannel: selectedTeamTwitchChannel.trim() || null,
      });
      setSelectedTeamId("");
      setSelectedTeamTwitchChannel("");
      toast({ title: `✓ ${t("teamAdded")}` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
      });
    }
  };

  const handleRemoveTeam = async (teamId: number) => {
    try {
      await removeTeam.mutateAsync({
        tournamentId,
        teamId,
      });
      setRemovingTeamId(null);
      toast({ title: `✓ ${t("teamRemoved")}` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
      });
    }
  };

  if (tournamentLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/tournaments")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("goBack")}
        </Button>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t("tournamentNotFound")}</p>
        </Card>
      </div>
    );
  }

  // Equipos que ya están en el torneo
  const tournamentTeamIds = new Set(tournamentTeams?.map((t) => t.id) || []);
  const availableTeams = teams?.filter((team) => !tournamentTeamIds.has(team.id)) || [];

  // fetch standings for this tournament
  const standingsTitle = t("standingsTitle", { tournament: tournament.name });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/tournaments")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("goBack")}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{tournament.name}</h1>
            {tournament.description && (
              <p className="text-muted-foreground mt-1">{tournament.description}</p>
            )}
          </div>
        </div>
        <Badge variant={statusVariants[tournament.status] || "secondary"}>
          {{
            draft: t("draft"),
            active: t("active"),
            finished: t("finished"),
          }[tournament.status] || tournament.status}
        </Badge>
      </div>

      {isVideogameTournament && (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Gamepad2 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-display text-lg font-bold">{t("videogameTournament")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("videogameTournamentDescription")}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* standings for this tournament */}
      <StandingsTable tournamentId={tournamentId} title={standingsTitle} />

      <Card className="p-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t("startDate")}</p>
            <p className="font-semibold">
              {new Date(tournament.startDate).toLocaleDateString(language === "es" ? "es-ES" : "en-US")}
            </p>
          </div>
          {tournament.endDate && (
            <div>
              <p className="text-muted-foreground">{t("endDate")}</p>
              <p className="font-semibold">
                {new Date(tournament.endDate).toLocaleDateString(language === "es" ? "es-ES" : "en-US")}
              </p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">{t("teams")}</p>
            <p className="font-semibold">{tournamentTeams?.length || 0}</p>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h2 className="text-2xl font-bold">{t("participantTeams")}</h2>
          {canManageTournaments && (
            <div className="flex gap-2">
              <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    {t("newTeam")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("newTeamForTournament", { tournament: tournament.name })}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateTeam} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="tournament-team-name">{t("teamNameLower")}</Label>
                      <Input
                        id="tournament-team-name"
                        value={newTeamName}
                        onChange={(event) => setNewTeamName(event.target.value)}
                        placeholder={t("teamNameLower")}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tournament-team-color">{t("color")}</Label>
                      <div className="flex gap-3 items-center">
                        <Input
                          id="tournament-team-color"
                          type="color"
                          value={newTeamColor}
                          onChange={(event) => setNewTeamColor(event.target.value)}
                          className="w-14 h-12 p-1 cursor-pointer"
                        />
                        <span className="text-sm font-mono text-muted-foreground">
                          {newTeamColor}
                        </span>
                      </div>
                    </div>
                    {isVideogameTournament && (
                      <div className="space-y-2">
                        <Label htmlFor="tournament-team-twitch">
                          {t("twitchChannel")} *
                        </Label>
                        <Input
                          id="tournament-team-twitch"
                          value={newTeamTwitchChannel}
                          onChange={(event) =>
                            setNewTeamTwitchChannel(event.target.value)
                          }
                          placeholder={t("twitchParticipantPlaceholder")}
                        />
                      </div>
                    )}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={
                        createTeam.isPending ||
                        !newTeamName.trim() ||
                        (isVideogameTournament && !newTeamTwitchChannel.trim())
                      }
                    >
                      {createTeam.isPending ? t("creating") : t("createAndEnrollTeam")}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Button
                size="sm"
                onClick={() => setLocation(`/tournaments/${tournamentId}/matches/new`)}
                disabled={(tournamentTeams?.length || 0) < 2}
                title={
                  (tournamentTeams?.length || 0) < 2
                    ? t("atLeastTwoTeamsNeeded")
                    : t("scheduleMatch")
                }
              >
                <Calendar className="w-4 h-4 mr-2" />
                {t("scheduleNewMatch")}
              </Button>
            </div>
          )}
        </div>

        {(teamsLoading || tournamentTeamsLoading) && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {tournamentTeams && tournamentTeams.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">{t("noTeamsInTournament")}</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {tournamentTeams?.map((team) => (
              <Card key={team.id} className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <TeamColorCircleSmall color={team.color} />
                  <div>
                    <span className="font-semibold">{team.name}</span>
                    {isVideogameTournament && (
                      <p className="text-xs text-muted-foreground">
                        Twitch: @{team.twitchChannel || t("noChannel")}
                      </p>
                    )}
                  </div>
                </div>
                {canManageTournaments && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setRemovingTeamId(team.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {canManageTournaments && availableTeams && availableTeams.length > 0 && (
        <Card className="p-6">
          <h3 className="font-bold mb-4">{t("addTeam")}</h3>
          <div className="flex gap-2">
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t("selectTeam")} />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map((team) => (
                  <SelectItem key={team.id} value={String(team.id)}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAddTeam}
              disabled={
                addTeam.isPending ||
                !selectedTeamId ||
                (isVideogameTournament && !selectedTeamTwitchChannel.trim())
              }
            >
              {addTeam.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("add")}
                </>
              )}
            </Button>
          </div>
          {isVideogameTournament && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="existing-team-twitch">{t("twitchChannel")} *</Label>
              <Input
                id="existing-team-twitch"
                value={selectedTeamTwitchChannel}
                onChange={(event) =>
                  setSelectedTeamTwitchChannel(event.target.value)
                }
                placeholder={t("twitchParticipantPlaceholder")}
              />
            </div>
          )}
        </Card>
      )}

      <AlertDialog
        open={removingTeamId !== null}
        onOpenChange={(open) => !open && setRemovingTeamId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeTeam")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeTeamDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removingTeamId && handleRemoveTeam(removingTeamId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("remove")}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
