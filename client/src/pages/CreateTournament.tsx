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
import { useLanguage } from "@/lib/i18n.tsx";
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
  const { t } = useLanguage();
  const createTournament = useCreateTournament();
  const updateTournament = useUpdateTournament();
  const { data: existingTournament } = useTournament(tournamentId || 0);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tournamentType: "soccer" as "soccer" | "videogame",
    startDate: "",
    endDate: "",
    status: "draft" as "draft" | "active" | "finished",
  });

  useEffect(() => {
    if (existingTournament) {
      setFormData({
        name: existingTournament.name || "",
        description: existingTournament.description || "",
        tournamentType:
          (existingTournament.tournamentType as "soccer" | "videogame") ||
          "soccer",
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
        title: t("error"),
        description: t("tournamentNameRequired"),
      });
      return;
    }

    if (!formData.startDate) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("startDateRequired"),
      });
      return;
    }

    try {
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        tournamentType: formData.tournamentType,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
        status: formData.status,
      };

      if (tournamentId) {
        await updateTournament.mutateAsync({ id: tournamentId, data });
        toast({ title: `✓ ${t("tournamentUpdated")}` });
      } else {
        await createTournament.mutateAsync(data as any);
        toast({ title: `✓ ${t("tournamentCreated")}` });
      }

      setLocation("/tournaments");
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: error instanceof Error ? error.message : t("unexpectedError"),
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
          {t("goBack")}
        </Button>
        <h1 className="text-3xl font-bold">
          {tournamentId ? t("editTournament") : t("createNewTournament")}
        </h1>
      </div>

      <Card className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">{t("tournamentName")} *</Label>
            <Input
              id="name"
              placeholder={t("tournamentNamePlaceholder")}
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              placeholder={t("tournamentDescriptionPlaceholder")}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tournamentType">{t("tournamentType")}</Label>
            <Select
              value={formData.tournamentType}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  tournamentType: value as "soccer" | "videogame",
                })
              }
            >
              <SelectTrigger id="tournamentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="soccer">{t("soccer")}</SelectItem>
                <SelectItem value="videogame">{t("videogameEfootball")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("videogameTournamentHint")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t("startDate")} *</Label>
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
              <Label htmlFor="endDate">{t("endDate")}</Label>
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
            <Label htmlFor="status">{t("status")}</Label>
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
                <SelectItem value="draft">{t("draft")}</SelectItem>
                <SelectItem value="active">{t("active")}</SelectItem>
                <SelectItem value="finished">{t("finished")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {tournamentId ? t("updating") : t("creating")}
                </>
              ) : tournamentId ? (
                t("updateTournament")
              ) : (
                t("createTournament")
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/tournaments")}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
