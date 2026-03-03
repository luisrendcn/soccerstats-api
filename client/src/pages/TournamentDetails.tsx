import { useTournament, useTournamentTeams, useAddTeamToTournament, useRemoveTeamFromTournament } from "@/hooks/use-tournaments";
import { useTeams } from "@/hooks/use-teams";
import { useLocation } from "wouter";
import { TeamColorCircleSmall } from "@/components/TeamColor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Plus, Trash2, Calendar } from "lucide-react";
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
import StandingsTable from "@/components/ui/StandingTable";

interface TournamentDetailsProps {
  tournamentId: number;
}

const statusLabels: Record<string, { label: string; variant: any }> = {
  draft: { label: "Borrador", variant: "secondary" },
  active: { label: "Activo", variant: "default" },
  finished: { label: "Finalizado", variant: "outline" },
};

export default function TournamentDetails({ tournamentId }: TournamentDetailsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: auth } = useAuth();
  const isPublic = auth?.userRole === 'public';
  const canManageTournaments = auth?.userRole === 'admin' || auth?.userRole === 'tournament_manager';
  
  const { data: tournament, isLoading: tournamentLoading } = useTournament(tournamentId);
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: tournamentTeams, isLoading: tournamentTeamsLoading } = useTournamentTeams(tournamentId);
  
  const addTeam = useAddTeamToTournament();
  const removeTeam = useRemoveTeamFromTournament();
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [removingTeamId, setRemovingTeamId] = useState<number | null>(null);

  const handleAddTeam = async () => {
    if (!selectedTeamId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Selecciona un equipo",
      });
      return;
    }

    try {
      await addTeam.mutateAsync({
        tournamentId,
        teamId: Number(selectedTeamId),
      });
      setSelectedTeamId("");
      toast({ title: "✓ Equipo agregado" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
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
      toast({ title: "✓ Equipo removido" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
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
          Volver
        </Button>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Torneo no encontrado</p>
        </Card>
      </div>
    );
  }

  // Equipos que ya están en el torneo
  const tournamentTeamIds = new Set(tournamentTeams?.map((t) => t.id) || []);
  const availableTeams = teams?.filter((team) => !tournamentTeamIds.has(team.id)) || [];

  // fetch standings for this tournament
  const standingsTitle = `${tournament.name} - Tabla de Posiciones`;

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
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{tournament.name}</h1>
            {tournament.description && (
              <p className="text-muted-foreground mt-1">{tournament.description}</p>
            )}
          </div>
        </div>
        <Badge variant={statusLabels[tournament.status]?.variant || "secondary"}>
          {statusLabels[tournament.status]?.label || tournament.status}
        </Badge>
      </div>

      {/* standings for this tournament */}
      <StandingsTable tournamentId={tournamentId} title={standingsTitle} />

      <Card className="p-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Fecha de Inicio</p>
            <p className="font-semibold">
              {new Date(tournament.startDate).toLocaleDateString("es-ES")}
            </p>
          </div>
          {tournament.endDate && (
            <div>
              <p className="text-muted-foreground">Fecha de Finalización</p>
              <p className="font-semibold">
                {new Date(tournament.endDate).toLocaleDateString("es-ES")}
              </p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">Equipos</p>
            <p className="font-semibold">{tournamentTeams?.length || 0}</p>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Equipos Participantes</h2>
        </div>

        {(teamsLoading || tournamentTeamsLoading) && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {tournamentTeams && tournamentTeams.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No hay equipos en este torneo</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {tournamentTeams?.map((team) => (
              <Card key={team.id} className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <TeamColorCircleSmall color={team.color} />
                  <span className="font-semibold">{team.name}</span>
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
          <h3 className="font-bold mb-4">Agregar Equipo</h3>
          <div className="flex gap-2">
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecciona un equipo" />
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
              disabled={addTeam.isPending || !selectedTeamId}
            >
              {addTeam.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      <AlertDialog
        open={removingTeamId !== null}
        onOpenChange={(open) => !open && setRemovingTeamId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Equipo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro que deseas remover este equipo del torneo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removingTeamId && handleRemoveTeam(removingTeamId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
