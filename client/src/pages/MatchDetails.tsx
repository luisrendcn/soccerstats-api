import { useState } from "react";
import { useRoute } from "wouter";
import { useMatch, useUpdateMatch, useCreateGoal, useMatchGoals } from "@/hooks/use-matches";
import {
  useCreateMatchHighlight,
  useDeleteMatchHighlight,
  useHighlightUploadSignature,
  useMatchHighlights,
  useUpdateMatchHighlight,
} from "@/hooks/use-highlights";
import { useTeam, useTeamPlayers } from "@/hooks/use-teams";
import { useTournament } from "@/hooks/use-tournaments";
import { Layout } from "@/components/Layout";
import { TeamColorCircleLarge } from "@/components/TeamColor";
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

const highlightTypeLabels: Record<string, string> = {
  goal: "Gol",
  save: "Atajada",
  assist: "Asistencia",
  foul: "Falta",
  penalty: "Penalti",
  free_kick: "Tiro libre",
  celebration: "Celebración",
  other: "Otra",
};

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Aprobado", className: "bg-green-100 text-green-800" },
  rejected: { label: "Rechazado", className: "bg-red-100 text-red-800" },
};

function buildCloudinaryThumbnail(videoUrl: string) {
  if (!videoUrl.includes("/video/upload/")) return undefined;
  return videoUrl
    .replace("/video/upload/", "/video/upload/so_0/")
    .replace(/\.[^/.]+$/, ".jpg");
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
  
  const { data: homePlayersResp } = useTeamPlayers(match?.homeTeamId || 0);
  const { data: awayPlayersResp } = useTeamPlayers(match?.awayTeamId || 0);
  const homePlayers = homePlayersResp;
  const awayPlayers = awayPlayersResp;

  const updateMatch = useUpdateMatch();
  const createGoal = useCreateGoal();
  const uploadSignature = useHighlightUploadSignature(matchId);
  const createHighlight = useCreateMatchHighlight(matchId);
  const updateHighlight = useUpdateMatchHighlight(matchId);
  const deleteHighlight = useDeleteMatchHighlight(matchId);
  const { toast } = useToast();
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
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [isHighlightDialogOpen, setIsHighlightDialogOpen] = useState(false);
  const [editingHighlight, setEditingHighlight] =
    useState<MatchHighlight | null>(null);
  const [highlightFile, setHighlightFile] = useState<File | null>(null);
  const [highlightTitle, setHighlightTitle] = useState("");
  const [highlightDescription, setHighlightDescription] = useState("");
  const [highlightType, setHighlightType] = useState("goal");
  const [highlightTeamId, setHighlightTeamId] = useState("");
  const [highlightPlayerId, setHighlightPlayerId] = useState("none");
  const [highlightMinute, setHighlightMinute] = useState("");

  const isLoading = matchLoading || goalsLoading || !match || !homeTeam || !awayTeam;
  const isFinished = match?.status === "finished";
  const allPlayers = [...(homePlayers || []), ...(awayPlayers || [])];
  const highlightTeamPlayers = allPlayers.filter(
    (player) => String(player.teamId) === highlightTeamId,
  );

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

  const resetHighlightForm = () => {
    setEditingHighlight(null);
    setHighlightFile(null);
    setHighlightTitle("");
    setHighlightDescription("");
    setHighlightType("goal");
    setHighlightTeamId(match?.homeTeamId ? String(match.homeTeamId) : "");
    setHighlightPlayerId("none");
    setHighlightMinute("");
  };

  const openEditHighlight = (highlight: MatchHighlight) => {
    setEditingHighlight(highlight);
    setHighlightFile(null);
    setHighlightTitle(highlight.title);
    setHighlightDescription(highlight.description || "");
    setHighlightType(highlight.highlightType);
    setHighlightTeamId(String(highlight.teamId));
    setHighlightPlayerId(highlight.playerId ? String(highlight.playerId) : "none");
    setHighlightMinute(String(highlight.minute));
    setIsHighlightDialogOpen(true);
  };

  const uploadHighlightVideo = async (file: File) => {
    const signature = await uploadSignature.mutateAsync();
    if (file.size > signature.maxFileSizeBytes) {
      throw new Error("El video supera el tamaño máximo permitido");
    }
    if (file.type !== "video/mp4" && !file.name.toLowerCase().endsWith(".mp4")) {
      throw new Error("Sólo se permiten videos MP4");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signature.apiKey);
    formData.append("timestamp", String(signature.timestamp));
    formData.append("folder", signature.folder);
    formData.append("signature", signature.signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/video/upload`,
      { method: "POST", body: formData },
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error?.message || "No se pudo subir el video");
    }
    if (payload.duration && payload.duration > signature.maxDurationSeconds) {
      throw new Error(
        `El video no debe superar ${signature.maxDurationSeconds} segundos`,
      );
    }

    return {
      videoUrl: payload.secure_url as string,
      videoPublicId: payload.public_id as string,
      thumbnailUrl: buildCloudinaryThumbnail(payload.secure_url),
      durationSeconds: payload.duration
        ? Math.round(Number(payload.duration))
        : undefined,
      fileSizeBytes: payload.bytes ? Number(payload.bytes) : file.size,
    };
  };

  const handleSaveHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!highlightTitle.trim() || !highlightTeamId || !highlightMinute) return;

    try {
      const basePayload = {
        teamId: Number(highlightTeamId),
        playerId:
          highlightPlayerId === "none" ? null : Number(highlightPlayerId),
        title: highlightTitle.trim(),
        description: highlightDescription.trim() || null,
        highlightType: highlightType as any,
        minute: Number(highlightMinute),
      };

      if (editingHighlight) {
        await updateHighlight.mutateAsync({
          id: editingHighlight.id,
          ...basePayload,
        });
        toast({ title: "Jugada actualizada" });
      } else {
        if (!highlightFile) {
          throw new Error("El video es obligatorio");
        }
        const upload = await uploadHighlightVideo(highlightFile);
        await createHighlight.mutateAsync({
          ...basePayload,
          ...upload,
        });
        toast({
          title: "Jugada enviada",
          description: "Quedó pendiente de aprobación.",
        });
      }

      setIsHighlightDialogOpen(false);
      resetHighlightForm();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (err as Error).message,
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
        title: status === "approved" ? "Jugada aprobada" : "Jugada rechazada",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (err as Error).message,
      });
    }
  };

  const handleDeleteHighlight = async (highlight: MatchHighlight) => {
    if (!confirm(`¿Eliminar la jugada "${highlight.title}"?`)) return;
    try {
      await deleteHighlight.mutateAsync(highlight.id);
      toast({ title: "Jugada eliminada" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (err as Error).message,
      });
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

      {/* Match Highlights */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center justify-between gap-3 px-2">
          <div>
            <h3 className="font-display text-lg flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              Mejores jugadas
            </h3>
            <p className="text-sm text-muted-foreground">
              Videos cortos del partido aprobados para el público.
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
                  Agregar jugada destacada
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingHighlight ? "Editar jugada" : "Agregar jugada destacada"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveHighlight} className="space-y-4 mt-4">
                  {!editingHighlight && (
                    <div className="space-y-2">
                      <Label>Video MP4</Label>
                      <Input
                        type="file"
                        accept="video/mp4,.mp4"
                        onChange={(e) =>
                          setHighlightFile(e.target.files?.[0] || null)
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Formato MP4. Duración máxima recomendada: 30 a 60 segundos.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={highlightTitle}
                      onChange={(e) => setHighlightTitle(e.target.value)}
                      placeholder="Ej. Golazo al ángulo"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descripción breve</Label>
                    <Textarea
                      value={highlightDescription}
                      onChange={(e) => setHighlightDescription(e.target.value)}
                      placeholder="Cuenta qué pasó en esta jugada"
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tipo de jugada</Label>
                      <Select value={highlightType} onValueChange={setHighlightType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(highlightTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Minuto</Label>
                      <Input
                        type="number"
                        min={0}
                        max={130}
                        value={highlightMinute}
                        onChange={(e) => setHighlightMinute(e.target.value)}
                        placeholder="Ej. 72"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Equipo relacionado</Label>
                      <Select
                        value={highlightTeamId}
                        onValueChange={(value) => {
                          setHighlightTeamId(value);
                          setHighlightPlayerId("none");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona equipo" />
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
                      <Label>Jugador, si aplica</Label>
                      <Select
                        value={highlightPlayerId}
                        onValueChange={setHighlightPlayerId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sin jugador" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin jugador</SelectItem>
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
                      uploadSignature.isPending ||
                      createHighlight.isPending ||
                      updateHighlight.isPending
                    }
                  >
                    {(uploadSignature.isPending ||
                      createHighlight.isPending ||
                      updateHighlight.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {editingHighlight ? "Guardar cambios" : "Subir jugada"}
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
              const status = statusLabels[highlight.status] || statusLabels.pending;

              return (
                <Card key={highlight.id} className="overflow-hidden">
                  <video
                    className="aspect-video w-full bg-black object-cover"
                    controls
                    preload="metadata"
                    poster={highlight.thumbnailUrl || undefined}
                    src={highlight.videoUrl}
                  />
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold leading-tight">
                          {highlight.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {team?.name || "Equipo"} · Minuto {highlight.minute}'
                          {player ? ` · ${player.name}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="secondary">
                          {highlightTypeLabels[highlight.highlightType] ||
                            "Otra"}
                        </Badge>
                        {canReviewHighlights && (
                          <Badge className={status.className}>
                            {status.label}
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
                            Aprobar
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
                            Rechazar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditHighlight(highlight)}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteHighlight(highlight)}
                          disabled={deleteHighlight.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Eliminar
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
            Aún no hay jugadas destacadas aprobadas para este partido.
          </div>
        )}
      </div>
    </Layout>
  );
}
