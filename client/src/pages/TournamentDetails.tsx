import {
  useTournament,
  useTournamentTeams,
  useAddTeamToTournament,
  useCreateTournamentTeam,
  useGenerateTournamentMatches,
  useImportTournamentTeams,
  useRemoveTeamFromTournament,
} from "@/hooks/use-tournaments";
import { useTeams } from "@/hooks/use-teams";
import { useDeleteMatch, useMatches } from "@/hooks/use-matches";
import { useLocation } from "wouter";
import { TeamColorCircleSmall } from "@/components/TeamColor";
import { MatchCard } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, ArrowLeft, Plus, Trash2, Calendar, Gamepad2, FileUp, CalendarPlus, Radio, Trash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQueries } from "@tanstack/react-query";
import {
  fetchTwitchStreamStatus,
  getTwitchChannelFromMatch,
  getTwitchStreamQueryKey,
  isTwitchStreamVisible,
  TwitchStreamCard,
} from "@/components/TwitchStreamCard";
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
import { parseTeamImportFile } from "@/lib/spreadsheet-import";
import { APP_TIME_ZONE, zonedLocalDateTimeToUtcIso } from "@shared/time";

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
  const canManageTournaments = auth?.userRole === 'admin' || auth?.userRole === 'tournament_manager';
  
  const {
    data: tournament,
    error: tournamentError,
    isLoading: tournamentLoading,
  } = useTournament(tournamentId);
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: tournamentTeams, isLoading: tournamentTeamsLoading } = useTournamentTeams(tournamentId);
  const { data: matches, isLoading: matchesLoading } = useMatches(1, 1000, "", tournamentId);
  
  const addTeam = useAddTeamToTournament();
  const createTeam = useCreateTournamentTeam();
  const importTeams = useImportTournamentTeams();
  const generateMatches = useGenerateTournamentMatches();
  const removeTeam = useRemoveTeamFromTournament();
  const deleteMatch = useDeleteMatch();
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [removingTeamId, setRemovingTeamId] = useState<number | null>(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#000000");
  const [newTeamTwitchChannel, setNewTeamTwitchChannel] = useState("");
  const [selectedTeamTwitchChannel, setSelectedTeamTwitchChannel] = useState("");
  const [isImportTeamsOpen, setIsImportTeamsOpen] = useState(false);
  const [teamsFile, setTeamsFile] = useState<File | null>(null);
  const [isGenerateScheduleOpen, setIsGenerateScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleIntervalDays, setScheduleIntervalDays] = useState("7");
  const [scheduleLocation, setScheduleLocation] = useState("");
  const isVideogameTournament = tournament?.tournamentType === "videogame";
  const canDeleteMatches = auth?.userRole === "admin";

  const enrichedMatches = matches
    ?.filter((match) => match.tournamentId === tournamentId)
    ?.map((match) => ({
      ...match,
      homeTeam: teams?.find((team) => team.id === match.homeTeamId),
      awayTeam: teams?.find((team) => team.id === match.awayTeamId),
      tournament,
    }))
    .filter((match) => match.homeTeam && match.awayTeam) || [];
  const streamMatches = enrichedMatches.filter(
    (match) => match.status === "live" && Boolean(getTwitchChannelFromMatch(match)),
  );
  const streamStatusQueries = useQueries({
    queries: streamMatches.map((match) => {
      const channel = getTwitchChannelFromMatch(match)!;
      return {
        queryKey: getTwitchStreamQueryKey(channel),
        queryFn: () => fetchTwitchStreamStatus(channel),
        staleTime: 15_000,
        refetchInterval: 15_000,
        retry: false,
      };
    }),
  });
  const liveMatches = streamMatches.filter((match, index) =>
    isTwitchStreamVisible(match, streamStatusQueries[index]?.data),
  );
  const scheduledMatches = enrichedMatches
    .filter((match) => match.status === "scheduled")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const finishedMatches = enrichedMatches
    .filter((match) => match.status === "finished")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

  const handleImportTeams = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamsFile) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("chooseExcelFile"),
      });
      return;
    }

    try {
      const teams = await parseTeamImportFile(teamsFile);
      if (teams.length === 0) {
        toast({
          variant: "destructive",
          title: t("error"),
          description: t("noRowsFound"),
        });
        return;
      }
      const result = await importTeams.mutateAsync({ tournamentId, teams });
      const importedCount = result.created.length + result.enrolledExisting.length;
      toast({
        title: t("teamsImported"),
        description: t("teamsImportedDescription", {
          count: importedCount,
          skipped: result.skipped.length,
        }),
      });
      setTeamsFile(null);
      setIsImportTeamsOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: error instanceof Error ? error.message : t("unexpectedError"),
      });
    }
  };

  const handleGenerateSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scheduleDate || !scheduleTime) {
      toast({
        variant: "destructive",
        title: t("missingFields"),
        description: t("scheduleBaseDateRequired"),
      });
      return;
    }

    try {
      const startAt = zonedLocalDateTimeToUtcIso(
        scheduleDate,
        scheduleTime,
        APP_TIME_ZONE,
      );
      const result = await generateMatches.mutateAsync({
        tournamentId,
        startAt,
        startDate: scheduleDate,
        startTime: scheduleTime,
        timeZone: APP_TIME_ZONE,
        intervalDays: Number(scheduleIntervalDays) || 7,
        location: scheduleLocation.trim() || null,
      });
      toast({
        title: t("roundsGenerated", { count: result.rounds }),
        description: t("matchesGeneratedDescription", {
          count: result.matches.length,
        }),
      });
      setIsGenerateScheduleOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: error instanceof Error ? error.message : t("unexpectedError"),
      });
    }
  };

  const handleDeleteMatch = async (matchId: number) => {
    if (!confirm(t("deleteMatchConfirm"))) return;
    try {
      await deleteMatch.mutateAsync(matchId);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("deleteMatchFailed"),
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
          <p className="text-muted-foreground">
            {tournamentError instanceof Error
              ? tournamentError.message
              : t("tournamentNotFound")}
          </p>
        </Card>
      </div>
    );
  }

  // Equipos que ya están en el torneo
  const tournamentTeamIds = new Set(tournamentTeams?.map((t) => t.id) || []);
  const availableTeams = teams?.filter((team) => !tournamentTeamIds.has(team.id)) || [];
  const teamCount = tournamentTeams?.length || 0;
  const hasOddTeamCount = teamCount > 0 && teamCount % 2 !== 0;
  const canGenerateSchedule = teamCount >= 2 && !hasOddTeamCount;
  const defaultScheduleDate = tournament.startDate
    ? new Date(tournament.startDate).toISOString().split("T")[0]
    : "";

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

      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold">{t("tournamentMatches")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("tournamentMatchesDescription")}
          </p>
        </div>

        {(matchesLoading || teamsLoading) && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {!matchesLoading && !teamsLoading && (
          <>
            <Accordion
              type="multiple"
              defaultValue={["live-matches"]}
              className="space-y-3"
            >
              <AccordionItem
                value="live-matches"
                className="rounded-xl border border-primary/20 bg-primary/5 px-4 shadow-sm"
              >
                <AccordionTrigger className="items-start gap-3 py-4 text-left hover:no-underline">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-display text-lg font-bold">
                      <Radio className="h-5 w-5 text-red-500" />
                      {t("liveMatches")}
                    </div>
                    <p className="mt-1 text-sm font-normal text-muted-foreground">
                      {t("liveMatchesDescription")}
                    </p>
                  </div>
                  <Badge className="bg-background text-primary shadow-sm">
                    {liveMatches.length}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  {liveMatches.length ? (
                    liveMatches.map((match) => (
                      <TwitchStreamCard key={match.id} match={match} />
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-border bg-background/70 p-4 text-center text-sm text-muted-foreground">
                      {t("noLiveMatches")}
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="scheduled-matches"
                className="rounded-xl border border-border bg-card px-4 shadow-sm"
              >
                <AccordionTrigger className="gap-3 py-4 text-left hover:no-underline">
                  <span className="font-display text-lg font-bold">
                    {t("scheduledMatches")}
                  </span>
                  <Badge className="ml-auto bg-yellow-100 text-yellow-800">
                    {scheduledMatches.length}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {scheduledMatches.length ? (
                    scheduledMatches.map((match) => (
                      <div key={match.id} className="relative">
                        <MatchCard match={match} />
                        {canDeleteMatches && (
                          <button
                            title={t("deleteMatch")}
                            className="absolute right-2 top-2 rounded-md bg-red-50 p-1 hover:bg-red-100"
                            onClick={() => handleDeleteMatch(match.id)}
                          >
                            <Trash className="h-4 w-4 text-red-600" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                      {t("noScheduledMatches")}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="finished-matches"
                className="rounded-xl border border-border bg-card px-4 shadow-sm"
              >
                <AccordionTrigger className="gap-3 py-4 text-left hover:no-underline">
                  <span className="font-display text-lg font-bold">
                    {t("finishedMatches")}
                  </span>
                  <Badge className="ml-auto bg-red-100 text-red-700">
                    {finishedMatches.length}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {finishedMatches.length ? (
                    finishedMatches.map((match) => (
                      <div key={match.id} className="relative">
                        <MatchCard match={match} />
                        {canDeleteMatches && (
                          <button
                            title={t("deleteMatch")}
                            className="absolute right-2 top-2 rounded-md bg-red-50 p-1 hover:bg-red-100"
                            onClick={() => handleDeleteMatch(match.id)}
                          >
                            <Trash className="h-4 w-4 text-red-600" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                      {t("noFinishedMatches")}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        )}
      </section>

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

      {canManageTournaments && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h2 className="text-2xl font-bold">{t("participantTeams")}</h2>
            <div className="flex flex-wrap gap-2">
              <Dialog open={isImportTeamsOpen} onOpenChange={setIsImportTeamsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FileUp className="w-4 h-4 mr-2" />
                    {t("importTeams")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("importTeamsFromExcel")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleImportTeams} className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      {t("excelTeamFormatHint")}
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="teams-excel">{t("chooseExcelFile")}</Label>
                      <Input
                        id="teams-excel"
                        type="file"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={(event) =>
                          setTeamsFile(event.target.files?.[0] || null)
                        }
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={importTeams.isPending || !teamsFile}
                    >
                      {importTeams.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t("importing")}
                        </>
                      ) : (
                        t("importTeams")
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
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
              <Dialog
                open={isGenerateScheduleOpen}
                onOpenChange={(open) => {
                  setIsGenerateScheduleOpen(open);
                  if (open && !scheduleDate) setScheduleDate(defaultScheduleDate);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={!canGenerateSchedule}
                    title={
                      hasOddTeamCount
                        ? t("oddTeamsBlocked")
                        : teamCount < 2
                          ? t("atLeastTwoTeamsNeeded")
                          : t("generateAutomaticSchedule")
                    }
                  >
                    <CalendarPlus className="w-4 h-4 mr-2" />
                    {t("generateSchedule")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("generateAutomaticSchedule")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleGenerateSchedule} className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      {t("generateScheduleDescription")}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="schedule-date">{t("firstMatchDate")}</Label>
                        <Input
                          id="schedule-date"
                          type="date"
                          value={scheduleDate}
                          onChange={(event) => setScheduleDate(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="schedule-time">{t("time")}</Label>
                        <Input
                          id="schedule-time"
                          type="time"
                          value={scheduleTime}
                          onChange={(event) => setScheduleTime(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="schedule-interval">{t("intervalDays")}</Label>
                        <Input
                          id="schedule-interval"
                          type="number"
                          min="0"
                          max="30"
                          value={scheduleIntervalDays}
                          onChange={(event) =>
                            setScheduleIntervalDays(event.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="schedule-location">{t("location")}</Label>
                        <Input
                          id="schedule-location"
                          value={scheduleLocation}
                          onChange={(event) => setScheduleLocation(event.target.value)}
                          placeholder={t("locationPlaceholder")}
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={generateMatches.isPending}
                    >
                      {generateMatches.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t("scheduling")}
                        </>
                      ) : (
                        t("generateSchedule")
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
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
          </div>

          {(teamsLoading || tournamentTeamsLoading) && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {hasOddTeamCount && (
            <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {t("oddTeamsBlocked")}
            </Card>
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
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setRemovingTeamId(team.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

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

      {canManageTournaments && (
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
      )}
    </div>
  );
}
