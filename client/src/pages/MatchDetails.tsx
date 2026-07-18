import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useMatch, useUpdateMatch, useCreateGoal, useMatchGoals } from "@/hooks/use-matches";
import {
  useCreateMatchHighlight,
  useDeleteMatchHighlight,
  useHighlightThumbnailSignature,
  useMatchHighlights,
  useUpdateMatchHighlight,
} from "@/hooks/use-highlights";
import { useTeam, useTeamPlayers } from "@/hooks/use-teams";
import { useTournament, useTournamentTeams } from "@/hooks/use-tournaments";
import { Layout } from "@/components/Layout";
import { TeamColorCircleLarge } from "@/components/TeamColor";
import { TwitchStreamCard, getTwitchChannelFromMatch } from "@/components/TwitchStreamCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Clock, MapPin, Trophy, CheckCircle2, Film, Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { MatchHighlight } from "@shared/schema";
import { useLanguage } from "@/lib/i18n.tsx";

const highlightTypeKeys = {
  goal: "highlightGoal",
  save: "highlightSave",
  assist: "highlightAssist",
  foul: "highlightFoul",
  penalty: "highlightPenalty",
  free_kick: "highlightFreeKick",
  celebration: "highlightCelebration",
  other: "highlightOther",
} as const;

const highlightStatusClasses: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

function wrapScoreNumber(value: number) {
  if (value > 9) return 0;
  if (value < 0) return 9;
  return value;
}

function ScoreWheel({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const normalizedValue = wrapScoreNumber(value || 0);
  const previous = wrapScoreNumber(normalizedValue - 1);
  const next = wrapScoreNumber(normalizedValue + 1);

  const move = (direction: 1 | -1) => {
    if (disabled) return;
    onChange(wrapScoreNumber(normalizedValue + direction));
  };

  return (
    <div
      className={cn(
        "w-14 select-none rounded-xl border border-border bg-muted/20 p-1.5 text-center shadow-inner sm:w-16",
        disabled ? "cursor-default opacity-90" : "cursor-ns-resize touch-none",
      )}
      onWheel={(event) => {
        if (disabled) return;
        event.preventDefault();
        move(event.deltaY < 0 ? 1 : -1);
      }}
      onTouchStart={(event) => setTouchStartY(event.touches[0].clientY)}
      onTouchEnd={(event) => {
        if (disabled || touchStartY === null) return;
        const deltaY = touchStartY - event.changedTouches[0].clientY;
        if (Math.abs(deltaY) > 20) {
          move(deltaY > 0 ? 1 : -1);
        }
        setTouchStartY(null);
      }}
      role="spinbutton"
      aria-valuemin={0}
      aria-valuemax={9}
      aria-valuenow={normalizedValue}
      aria-label={label}
    >
      <button
        type="button"
        className="w-full rounded-md py-0 text-xs text-muted-foreground disabled:opacity-40"
        onClick={() => move(-1)}
        disabled={disabled}
        aria-label={`Disminuir ${label}`}
      >
        {previous}
      </button>
      <div className="my-0.5 rounded-lg bg-background py-1.5 text-3xl font-black text-primary shadow-sm sm:text-4xl">
        {normalizedValue}
      </div>
      <button
        type="button"
        className="w-full rounded-md py-0 text-xs text-muted-foreground disabled:opacity-40"
        onClick={() => move(1)}
        disabled={disabled}
        aria-label={`Aumentar ${label}`}
      >
        {next}
      </button>
    </div>
  );
}

function getYouTubeVideoId(videoUrl: string) {
  try {
    const url = new URL(videoUrl);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.slice(1).split("/")[0];
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      const watchId = url.searchParams.get("v");
      if (watchId) return watchId;
      const parts = url.pathname.split("/").filter(Boolean);
      if (
        (parts[0] === "shorts" ||
          parts[0] === "embed" ||
          parts[0] === "live") &&
        parts[1]
      ) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }
  return null;
}

function getYouTubeEmbedUrl(videoUrl: string) {
  const id = getYouTubeVideoId(videoUrl);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export default function MatchDetails() {
  const [matchRoute, params] = useRoute("/matches/:id");
  const matchId = params ? parseInt(params.id) : 0;
  
  const { data: match, isLoading: matchLoading } = useMatch(matchId);
  const { data: goals, isLoading: goalsLoading } = useMatchGoals(matchId);
  const { data: highlights, isLoading: highlightsLoading } =
    useMatchHighlights(matchId);
  
  const { data: homeTeam } = useTeam(match?.homeTeamId || 0);
  const { data: awayTeam } = useTeam(match?.awayTeamId || 0);
  const { data: tournament } = useTournament(match?.tournamentId || 0);
  const { data: tournamentTeams } = useTournamentTeams(match?.tournamentId || 0);
  
  const { data: homePlayersResp } = useTeamPlayers(match?.homeTeamId || 0);
  const { data: awayPlayersResp } = useTeamPlayers(match?.awayTeamId || 0);
  const homePlayers = homePlayersResp;
  const awayPlayers = awayPlayersResp;

  const updateMatch = useUpdateMatch();
  const createGoal = useCreateGoal();
  const thumbnailSignature = useHighlightThumbnailSignature(matchId);
  const createHighlight = useCreateMatchHighlight(matchId);
  const updateHighlight = useUpdateMatchHighlight(matchId);
  const deleteHighlight = useDeleteMatchHighlight(matchId);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: auth } = useAuth();
  const canModifyMatch = auth?.userRole === 'admin' || auth?.userRole === 'tournament_manager' || auth?.userRole === 'referee';
  const canReviewHighlights =
    auth?.userRole === "admin" ||
    (auth?.userRole === "tournament_manager" &&
      tournament?.createdBy === auth.userId);
  const canUploadHighlights =
    !!auth &&
    (canReviewHighlights ||
      auth.userRole === "referee" ||
      ((auth.userRole === "team_captain" || auth.userRole === "team") &&
        [match?.homeTeamId, match?.awayTeamId].includes(auth.teamId || 0)));
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("unknown");
  const [goalMinute, setGoalMinute] = useState("");
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [isLiveDialogOpen, setIsLiveDialogOpen] = useState(false);
  const [selectedLiveChannel, setSelectedLiveChannel] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [isHighlightDialogOpen, setIsHighlightDialogOpen] = useState(false);
  const [editingHighlight, setEditingHighlight] =
    useState<MatchHighlight | null>(null);
  const [highlightThumbnailFile, setHighlightThumbnailFile] =
    useState<File | null>(null);
  const [highlightVideoUrl, setHighlightVideoUrl] = useState("");
  const [highlightTitle, setHighlightTitle] = useState("");
  const [highlightDescription, setHighlightDescription] = useState("");
  const [highlightType, setHighlightType] = useState("goal");
  const [highlightTeamId, setHighlightTeamId] = useState("");
  const [highlightPlayerId, setHighlightPlayerId] = useState("none");
  const [highlightMinute, setHighlightMinute] = useState("");
  const [playingHighlightIds, setPlayingHighlightIds] = useState<
    Record<number, boolean>
  >({});
  const [optimisticScore, setOptimisticScore] = useState<{
    matchId: number;
    homeScore: number;
    awayScore: number;
  } | null>(null);
  const [pendingScoreSave, setPendingScoreSave] = useState<{
    matchId: number;
    homeScore: number;
    awayScore: number;
  } | null>(null);

  const isLoading = matchLoading || goalsLoading || !match || !homeTeam || !awayTeam;
  const isFinished = match?.status === "finished";
  const isLive = match?.status === "live";
  const currentTwitchChannel = match ? getTwitchChannelFromMatch(match) : null;
  const hasTwitchStream = Boolean(currentTwitchChannel);
  const currentOptimisticScore =
    optimisticScore?.matchId === match?.id ? optimisticScore : null;
  const displayedHomeScore =
    currentOptimisticScore
      ? currentOptimisticScore.homeScore
      : match?.homeScore || 0;
  const displayedAwayScore =
    currentOptimisticScore
      ? currentOptimisticScore.awayScore
      : match?.awayScore || 0;
  const allPlayers = [...(homePlayers || []), ...(awayPlayers || [])];
  const selectedGoalTeamPlayers =
    selectedTeamId === String(homeTeam?.id)
      ? homePlayers || []
      : selectedTeamId === String(awayTeam?.id)
        ? awayPlayers || []
        : [];
  const highlightTeamPlayers = allPlayers.filter(
    (player) => String(player.teamId) === highlightTeamId,
  );
  const homeTournamentTeam = tournamentTeams?.find(
    (team) => team.id === match?.homeTeamId,
  );
  const awayTournamentTeam = tournamentTeams?.find(
    (team) => team.id === match?.awayTeamId,
  );
  const liveBroadcastOptions = [
    homeTournamentTeam && {
      teamName: homeTeam?.name || t("localTeam"),
      channel: homeTournamentTeam.twitchChannel,
    },
    awayTournamentTeam && {
      teamName: awayTeam?.name || t("awayTeamLabel"),
      channel: awayTournamentTeam.twitchChannel,
    },
  ].filter(
    (option): option is { teamName: string; channel: string } =>
      Boolean(option?.channel),
  );
  const canSelectLiveBroadcast =
    liveBroadcastOptions.length > 0 || hasTwitchStream;

  useEffect(() => {
    if (!match) return;
    if (pendingScoreSave?.matchId === match.id) return;
    setOptimisticScore({
      matchId: match.id,
      homeScore: match.homeScore || 0,
      awayScore: match.awayScore || 0,
    });
  }, [match?.id, match?.homeScore, match?.awayScore, pendingScoreSave?.matchId]);

  useEffect(() => {
    if (!pendingScoreSave) return;
    const saveTimer = window.setTimeout(async () => {
      const scoreToSave = pendingScoreSave;
      try {
        await updateMatch.mutateAsync({
          id: scoreToSave.matchId,
          homeScore: scoreToSave.homeScore,
          awayScore: scoreToSave.awayScore,
        });
        setPendingScoreSave((current) =>
          current === scoreToSave ? null : current,
        );
      } catch (err) {
        setPendingScoreSave((current) =>
          current === scoreToSave ? null : current,
        );
        if (match?.id === scoreToSave.matchId) {
          setOptimisticScore({
            matchId: match.id,
            homeScore: match.homeScore || 0,
            awayScore: match.awayScore || 0,
          });
        }
        toast({
          variant: "destructive",
          title: t("error"),
          description: t("scoreUpdateFailed"),
        });
      }
    }, 350);

    return () => window.clearTimeout(saveTimer);
  }, [pendingScoreSave, match?.id, match?.homeScore, match?.awayScore]);

  const handleGoalTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    setSelectedPlayerId("unknown");
  };

  const handleScoreWheelChange = (
    teamSide: "home" | "away",
    score: number,
  ) => {
    if (!match || !canModifyMatch || isFinished) return;
    const nextScore = {
      matchId: match.id,
      homeScore: teamSide === "home" ? score : displayedHomeScore,
      awayScore: teamSide === "away" ? score : displayedAwayScore,
    };
    setOptimisticScore(nextScore);
    setPendingScoreSave(nextScore);
  };

  const handleFinishMatch = async () => {
    if (!match) return;
    try {
      await updateMatch.mutateAsync({ id: match.id, status: "finished" });
      toast({ title: t("matchFinished"), description: t("finalScoreRecorded") });
    } catch (err) {
      toast({ variant: "destructive", title: t("error"), description: t("failedToFinishMatch") });
    }
  };

  const openLiveDialog = () => {
    const preferredChannel =
      (currentTwitchChannel &&
        liveBroadcastOptions.some(
          (option) => option.channel === currentTwitchChannel,
        ) &&
        currentTwitchChannel) ||
      liveBroadcastOptions[0]?.channel ||
      currentTwitchChannel ||
      "";
    setSelectedLiveChannel(preferredChannel);
    setIsLiveDialogOpen(true);
  };

  const handleStartLive = async () => {
    if (!match || !selectedLiveChannel) return;
    try {
      await updateMatch.mutateAsync({
        id: match.id,
        status: "live",
        streamPlatform: "twitch",
        streamChannel: selectedLiveChannel,
        streamUrl: `https://www.twitch.tv/${selectedLiveChannel}`,
      });
      setIsLiveDialogOpen(false);
      toast({
        title: t("matchMarkedLive"),
        description: t("matchMarkedLiveDescription"),
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("failedToMarkLive"),
      });
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId || !goalMinute) return;

    try {
      await createGoal.mutateAsync({
        matchId,
        teamId: parseInt(selectedTeamId),
        playerId: selectedPlayerId === "unknown" ? undefined : parseInt(selectedPlayerId),
        minute: parseInt(goalMinute)
      });

      toast({ title: t("goalDetailSaved"), description: t("goalRecordedDescription") });
      setIsGoalDialogOpen(false);
      setGoalMinute("");
      setSelectedPlayerId("unknown");
    } catch (err) {
      toast({ variant: "destructive", title: t("error"), description: t("unexpectedError") });
    }
  };

  const resetHighlightForm = () => {
    setEditingHighlight(null);
    setHighlightThumbnailFile(null);
    setHighlightVideoUrl("");
    setHighlightTitle("");
    setHighlightDescription("");
    setHighlightType("goal");
    setHighlightTeamId(match?.homeTeamId ? String(match.homeTeamId) : "");
    setHighlightPlayerId("none");
    setHighlightMinute("");
  };

  const openEditHighlight = (highlight: MatchHighlight) => {
    setEditingHighlight(highlight);
    setHighlightThumbnailFile(null);
    setHighlightVideoUrl(highlight.videoUrl);
    setHighlightTitle(highlight.title);
    setHighlightDescription(highlight.description || "");
    setHighlightType(highlight.highlightType);
    setHighlightTeamId(String(highlight.teamId));
    setHighlightPlayerId(highlight.playerId ? String(highlight.playerId) : "none");
    setHighlightMinute(String(highlight.minute));
    setIsHighlightDialogOpen(true);
  };

  const uploadHighlightThumbnail = async (file: File) => {
    const signature = await thumbnailSignature.mutateAsync();
    if (file.size > signature.maxFileSizeBytes) {
      throw new Error(t("thumbnailTooLarge"));
    }
    if (!file.type.startsWith("image/")) {
      throw new Error(t("thumbnailMustBeImage"));
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signature.apiKey);
    formData.append("timestamp", String(signature.timestamp));
    formData.append("folder", signature.folder);
    formData.append("signature", signature.signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
      { method: "POST", body: formData },
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error?.message || t("thumbnailUploadError"));
    }

    return {
      thumbnailUrl: payload.secure_url as string,
      fileSizeBytes: payload.bytes ? Number(payload.bytes) : file.size,
    };
  };

  const handleSaveHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!highlightTitle.trim() || !highlightTeamId || !highlightMinute || !highlightVideoUrl.trim()) return;

    try {
      if (!getYouTubeEmbedUrl(highlightVideoUrl.trim())) {
        throw new Error(t("validYoutubeRequired"));
      }

      const basePayload = {
        teamId: Number(highlightTeamId),
        playerId:
          highlightPlayerId === "none" ? null : Number(highlightPlayerId),
        title: highlightTitle.trim(),
        description: highlightDescription.trim() || null,
        highlightType: highlightType as any,
        minute: Number(highlightMinute),
        videoUrl: highlightVideoUrl.trim(),
        videoPublicId: null,
      };
      let thumbnailPayload = {};
      if (highlightThumbnailFile) {
        try {
          thumbnailPayload = await uploadHighlightThumbnail(highlightThumbnailFile);
        } catch (thumbnailError) {
          toast({
            variant: "destructive",
            title: t("thumbnailUploadFailed"),
            description: t("thumbnailUploadFailedDescription"),
          });
          console.warn("Highlight thumbnail upload failed", thumbnailError);
        }
      }

      if (editingHighlight) {
        await updateHighlight.mutateAsync({
          id: editingHighlight.id,
          ...basePayload,
          ...thumbnailPayload,
        });
        toast({ title: t("highlightUpdated") });
      } else {
        await createHighlight.mutateAsync({
          ...basePayload,
          thumbnailUrl: null,
          ...thumbnailPayload,
        });
        toast({
          title: t("highlightSubmitted"),
          description: t("highlightSubmittedDescription"),
        });
      }

      setIsHighlightDialogOpen(false);
      resetHighlightForm();
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
      });
    }
  };

  const handleHighlightStatus = async (
    highlight: MatchHighlight,
    status: "approved" | "rejected",
  ) => {
    try {
      await updateHighlight.mutateAsync({ id: highlight.id, status });
      toast({
        title: status === "approved" ? t("highlightApproved") : t("highlightRejected"),
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
      });
    }
  };

  const handleDeleteHighlight = async (highlight: MatchHighlight) => {
    if (!confirm(t("deleteHighlightConfirm", { title: highlight.title }))) return;
    try {
      await deleteHighlight.mutateAsync(highlight.id);
      toast({ title: t("highlightDeleted") });
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
      });
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <Layout title={t("matchCenter")}>
      {/* Scoreboard */}
      <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden mb-8">
        <div className="bg-muted/30 p-3 text-center text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-border/50 flex justify-center items-center gap-2">
          {isFinished ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3 h-3"/> {t("finalScore")}</span> : isLive ? <span className="flex items-center gap-1 text-red-500"><Clock className="w-3 h-3"/> {t("live")}</span> : <span className="flex items-center gap-1 text-primary"><Clock className="w-3 h-3"/> {t("liveMatch")}</span>}
        </div>
        
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 mb-6">
            <div className="min-w-0 flex flex-col items-center gap-2">
              <TeamColorCircleLarge color={homeTeam.color}>
                {homeTeam.name.substring(0, 1)}
              </TeamColorCircleLarge>
              <h3 className="font-display text-xs font-bold text-center leading-tight sm:text-base">{homeTeam.name}</h3>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <ScoreWheel
                  label={`${t("goals")} ${homeTeam.name}`}
                  value={displayedHomeScore}
                  onChange={(score) => handleScoreWheelChange("home", score)}
                  disabled={!canModifyMatch || isFinished}
                />
                <span className="text-2xl font-mono font-bold text-muted-foreground sm:text-3xl">
                  -
                </span>
                <ScoreWheel
                  label={`${t("goals")} ${awayTeam.name}`}
                  value={displayedAwayScore}
                  onChange={(score) => handleScoreWheelChange("away", score)}
                  disabled={!canModifyMatch || isFinished}
                />
              </div>
              {canModifyMatch && !isFinished && (
                <p className="mt-2 max-w-36 text-center text-[10px] leading-tight text-muted-foreground sm:max-w-48 sm:text-[11px]">
                  {t("slideScoreHint")}
                </p>
              )}
              <div className="mt-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {format(new Date(match.date), "HH:mm")}
              </div>
            </div>

            <div className="min-w-0 flex flex-col items-center gap-2">
              <TeamColorCircleLarge color={awayTeam.color}>
                {awayTeam.name.substring(0, 1)}
              </TeamColorCircleLarge>
              <h3 className="font-display text-xs font-bold text-center leading-tight sm:text-base">{awayTeam.name}</h3>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{match.location || t("mainStadium")}</span>
          </div>
        </div>

        {/* Actions */}
        {!isFinished && (
          <div className="p-4 bg-muted/10 border-t border-border grid grid-cols-2 gap-3">
            {canModifyMatch && (
              <>
              <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full shadow-sm" variant="outline">
                  <Trophy className="w-4 h-4 mr-2" /> {t("goalDetail")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("addGoalDetail")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddGoal} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>{t("scoringTeam")}</Label>
                    <Select value={selectedTeamId} onValueChange={handleGoalTeamChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectTeam")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={String(homeTeam.id)}>{homeTeam.name}</SelectItem>
                        <SelectItem value={String(awayTeam.id)}>{awayTeam.name}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("playerIfApplicable")}</Label>
                    <Select
                      value={selectedPlayerId}
                      onValueChange={setSelectedPlayerId}
                      disabled={!selectedTeamId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectPlayer")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">{t("noPlayerUnknown")}</SelectItem>
                        {selectedGoalTeamPlayers.map((player) => (
                          <SelectItem key={player.id} value={String(player.id)}>
                            {player.name} #{player.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("minute")}</Label>
                    <Input 
                      type="number" 
                      placeholder="45"
                      value={goalMinute}
                      onChange={e => setGoalMinute(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={createGoal.isPending}>
                    {t("saveDetail")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

              <Button variant="outline" className="w-full" onClick={handleFinishMatch} disabled={updateMatch.isPending}>
                {t("endMatch")}
              </Button>
              {!isLive && canSelectLiveBroadcast && (
                <Button type="button" variant="secondary" className="w-full" onClick={openLiveDialog} disabled={updateMatch.isPending}>
                  {t("markLive")}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>

      {hasTwitchStream && match && (
        <div className="mb-8">
          <TwitchStreamCard
            match={{
              ...match,
              homeTeam,
              awayTeam,
              tournament,
            }}
          />
        </div>
      )}

      <Dialog open={isLiveDialogOpen} onOpenChange={setIsLiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("selectLiveBroadcastChannel")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("selectLiveBroadcastChannelDescription")}
            </p>
            <div className="space-y-2">
              <Label>{t("broadcastChannel")}</Label>
              <Select
                value={selectedLiveChannel}
                onValueChange={setSelectedLiveChannel}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectTwitchChannel")} />
                </SelectTrigger>
                <SelectContent>
                  {liveBroadcastOptions.map((option) => (
                    <SelectItem key={option.channel} value={option.channel}>
                      {option.teamName} - @{option.channel}
                    </SelectItem>
                  ))}
                  {currentTwitchChannel &&
                    !liveBroadcastOptions.some(
                      (option) => option.channel === currentTwitchChannel,
                    ) && (
                      <SelectItem value={currentTwitchChannel}>
                        {t("currentBroadcastChannel")} - @{currentTwitchChannel}
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
            {liveBroadcastOptions.length === 0 && !currentTwitchChannel && (
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                {t("liveBroadcastChannelsMissing")}
              </p>
            )}
            <Button
              type="button"
              className="w-full"
              onClick={handleStartLive}
              disabled={updateMatch.isPending || !selectedLiveChannel}
            >
              {updateMatch.isPending ? t("loading") : t("markLive")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Match Events */}
      <div className="space-y-4">
        <h3 className="font-display text-lg px-2">{t("matchEvents")}</h3>
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
                    <p className="font-bold text-sm">{player?.name || t("unknownPlayer")}</p>
                    <p className="text-xs text-muted-foreground">{isHomeGoal ? homeTeam.name : awayTeam.name}</p>
                  </div>
                </div>
              </div>
            );
          })}
          
          {goals?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm italic">
              {t("noGoalsRecorded")}
            </div>
          )}
        </div>
      </div>

      {/* Match Highlights */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center justify-between gap-3 px-2">
          <div>
            <h3 className="font-display text-lg flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              {t("highlights")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("highlightsDescription")}
            </p>
          </div>

          {canUploadHighlights && (
            <Dialog
              open={isHighlightDialogOpen}
              onOpenChange={(open) => {
                setIsHighlightDialogOpen(open);
                if (!open) resetHighlightForm();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => {
                    resetHighlightForm();
                    setIsHighlightDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("addHighlight")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingHighlight ? t("editHighlight") : t("addFeaturedPlay")}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveHighlight} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>{t("youtubeLink")}</Label>
                    <Input
                      type="url"
                      value={highlightVideoUrl}
                      onChange={(e) => setHighlightVideoUrl(e.target.value)}
                      placeholder="https://youtu.be/... o https://www.youtube.com/watch?v=..."
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("youtubeLinkHint")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("optionalThumbnail")}</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setHighlightThumbnailFile(e.target.files?.[0] || null)
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("thumbnailHint")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("title")}</Label>
                    <Input
                      value={highlightTitle}
                      onChange={(e) => setHighlightTitle(e.target.value)}
                      placeholder={t("highlightTitlePlaceholder")}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("shortDescription")}</Label>
                    <Textarea
                      value={highlightDescription}
                      onChange={(e) => setHighlightDescription(e.target.value)}
                      placeholder={t("highlightDescriptionPlaceholder")}
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("highlightType")}</Label>
                      <Select value={highlightType} onValueChange={setHighlightType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(highlightTypeKeys).map(([value, labelKey]) => (
                            <SelectItem key={value} value={value}>
                              {t(labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("minute")}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={130}
                        value={highlightMinute}
                        onChange={(e) => setHighlightMinute(e.target.value)}
                        placeholder="72"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("relatedTeam")}</Label>
                      <Select
                        value={highlightTeamId}
                        onValueChange={(value) => {
                          setHighlightTeamId(value);
                          setHighlightPlayerId("none");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectTeam")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={String(homeTeam.id)}>
                            {homeTeam.name}
                          </SelectItem>
                          <SelectItem value={String(awayTeam.id)}>
                            {awayTeam.name}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("playerIfApplicable")}</Label>
                      <Select
                        value={highlightPlayerId}
                        onValueChange={setHighlightPlayerId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("noPlayerUnknown")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("noPlayerUnknown")}</SelectItem>
                          {highlightTeamPlayers.map((player) => (
                            <SelectItem key={player.id} value={String(player.id)}>
                              {player.name} #{player.number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      thumbnailSignature.isPending ||
                      createHighlight.isPending ||
                      updateHighlight.isPending
                    }
                  >
                    {(thumbnailSignature.isPending ||
                      createHighlight.isPending ||
                      updateHighlight.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {editingHighlight ? t("saveChanges") : t("uploadHighlight")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {highlightsLoading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : highlights?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {highlights.map((highlight) => {
              const team =
                highlight.teamId === homeTeam.id
                  ? homeTeam
                  : highlight.teamId === awayTeam.id
                    ? awayTeam
                    : undefined;
              const player = allPlayers.find((p) => p.id === highlight.playerId);
              const statusClassName = highlightStatusClasses[highlight.status] || highlightStatusClasses.pending;
              const embedUrl = getYouTubeEmbedUrl(highlight.videoUrl);
              const shouldShowPlayer =
                !!embedUrl &&
                (!highlight.thumbnailUrl || playingHighlightIds[highlight.id]);

              return (
                <Card key={highlight.id} className="overflow-hidden">
                  {shouldShowPlayer ? (
                    <iframe
                      className="aspect-video w-full bg-black"
                      src={embedUrl}
                      title={highlight.title}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : embedUrl && highlight.thumbnailUrl ? (
                    <div className="relative aspect-video w-full bg-black">
                      <img
                        src={highlight.thumbnailUrl}
                        alt={highlight.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                        <Button
                          type="button"
                          onClick={() =>
                            setPlayingHighlightIds((current) => ({
                              ...current,
                              [highlight.id]: true,
                            }))
                          }
                        >
                          {t("play")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-muted flex items-center justify-center text-sm text-muted-foreground">
                      {t("youtubeUnavailable")}
                    </div>
                  )}
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold leading-tight">
                          {highlight.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {team?.name || t("teamFallback")} · {t("minuteLabel")} {highlight.minute}'
                          {player ? ` · ${player.name}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="secondary">
                          {t(
                            highlightTypeKeys[
                              highlight.highlightType as keyof typeof highlightTypeKeys
                            ] || "highlightOther",
                          )}
                        </Badge>
                        {canReviewHighlights && (
                          <Badge className={statusClassName}>
                            {{
                              pending: t("pending"),
                              approved: t("approved"),
                              rejected: t("rejected"),
                            }[highlight.status] || t("pending")}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {highlight.description && (
                      <p className="text-sm text-muted-foreground">
                        {highlight.description}
                      </p>
                    )}

                    {canReviewHighlights && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {highlight.status !== "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleHighlightStatus(highlight, "approved")
                            }
                            disabled={updateHighlight.isPending}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            {t("approve")}
                          </Button>
                        )}
                        {highlight.status !== "rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleHighlightStatus(highlight, "rejected")
                            }
                            disabled={updateHighlight.isPending}
                          >
                            <X className="w-4 h-4 mr-1" />
                            {t("reject")}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditHighlight(highlight)}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          {t("edit")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteHighlight(highlight)}
                          disabled={deleteHighlight.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {t("delete")}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("noApprovedHighlights")}
          </div>
        )}
      </div>
    </Layout>
  );
}
