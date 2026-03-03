import { useCreateTournament, useTournament, useUpdateTournament } from "@/hooks/use-tournaments";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TournamentFormProps {
  tournamentId?: number;
}

export default function CreateTournament({ tournamentId }: TournamentFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createTournament = useCreateTournament();
  const updateTournament = useUpdateTournament();
  const { data: existingTournament } = useTournament(tournamentId || 0);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    status: "draft" as "draft" | "active" | "finished",
  });

  useEffect(() => {
    if (existingTournament) {
      setFormData({
        name: existingTournament.name || "",
        description: existingTournament.description || "",
        startDate: existingTournament.startDate
          ? new Date(existingTournament.startDate).toISOString().split("T")[0]
          : "",
        endDate: existingTournament.endDate
          ? new Date(existingTournament.endDate).toISOString().split("T")[0]
          : "",
        status: (existingTournament.status as any) || "draft",
      });
    }
  }, [existingTournament]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El nombre del torneo es requerido",
      });
      return;
    }

    if (!formData.startDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "La fecha de inicio es requerida",
      });
      return;
    }

    try {
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        status: formData.status,
      };

      if (tournamentId) {
        await updateTournament.mutateAsync({ id: tournamentId, data });
        toast({ title: "✓ Torneo actualizado" });
      } else {
        await createTournament.mutateAsync(data as any);
        toast({ title: "✓ Torneo creado exitosamente" });
      }

      setLocation("/tournaments");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    }
  };

  const isLoading = createTournament.isPending || updateTournament.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/tournaments")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">
          {tournamentId ? "Editar Torneo" : "Crear Nuevo Torneo"}
        </h1>
      </div>

      <Card className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Torneo *</Label>
            <Input
              id="name"
              placeholder="ej: Campeonato Municipal 2026"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Descripción del torneo (opcional)"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de Inicio *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha de Finalización</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  status: value as "draft" | "active" | "finished",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="finished">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {tournamentId ? "Actualizando..." : "Creando..."}
                </>
              ) : tournamentId ? (
                "Actualizar Torneo"
              ) : (
                "Crear Torneo"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/tournaments")}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
