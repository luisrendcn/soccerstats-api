import { useTournaments } from "@/hooks/use-tournaments";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Calendar, MapPin } from "lucide-react";
import { useDeleteTournament } from "@/hooks/use-tournaments";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Layout } from "@/components/Layout";

const statusLabels: Record<string, { label: string; variant: any }> = {
  draft: { label: "Borrador", variant: "secondary" },
  active: { label: "Activo", variant: "default" },
  finished: { label: "Finalizado", variant: "outline" },
};

export default function Tournaments() {
  const [, setLocation] = useLocation();
  const { data: tournaments, isLoading } = useTournaments();
  const { data: auth } = useAuth();
  const isPublic = auth?.userRole === 'public';
  const canManageTournaments = auth?.userRole === 'admin' || auth?.userRole === 'tournament_manager';
  const deleteTournament = useDeleteTournament();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await deleteTournament.mutateAsync(id);
      toast({ title: "✓ Torneo eliminado" });
      setDeletingId(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout title="Torneos">
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Torneos</h1>
        {canManageTournaments && (
          <Button onClick={() => setLocation("/tournaments/new")} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Torneo
          </Button>
        )}
      </div>

      {!tournaments || tournaments.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No hay torneos creados aún</p>
            {canManageTournaments && (
              <Button onClick={() => setLocation("/tournaments/new")}>
                Crear Primer Torneo
              </Button>
            )}
          </Card>
      ) : (
        <div className="grid gap-4">
          {tournaments.map((tournament) => (
            <Card key={tournament.id} className="p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation(`/tournaments/${tournament.id}`)}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{tournament.name}</h2>
                  {tournament.description && (
                    <p className="text-sm text-muted-foreground mt-1">{tournament.description}</p>
                  )}
                </div>
                <Badge variant={statusLabels[tournament.status]?.variant || "secondary"}>
                  {statusLabels[tournament.status]?.label || tournament.status}
                </Badge>
              </div>

              <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                {tournament.startDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(tournament.startDate).toLocaleDateString("es-ES")}
                  </div>
                )}
                {tournament.endDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(tournament.endDate).toLocaleDateString("es-ES")}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(`/tournaments/${tournament.id}`);
                  }}
                >
                  Ver Detalles
                </Button>
                {canManageTournaments && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(tournament.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Torneo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro que deseas eliminar este torneo? No se puede deshacer esta acción.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </Layout>
  );
}
