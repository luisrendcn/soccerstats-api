import { useTournaments } from "@/hooks/use-tournaments";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Calendar, Gamepad2 } from "lucide-react";
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
import { useLanguage } from "@/lib/i18n.tsx";

const fallbackTournamentBackgrounds = [
  "from-emerald-900 via-slate-900 to-sky-900",
  "from-indigo-900 via-slate-900 to-rose-900",
  "from-zinc-900 via-stone-900 to-amber-900",
];

const statusBadgeClasses: Record<string, string> = {
  draft: "border-yellow-300/50 bg-yellow-300 text-yellow-950",
  active: "border-emerald-300/50 bg-emerald-400 text-emerald-950",
  finished: "border-red-300/50 bg-red-400 text-red-950",
};

export default function Tournaments() {
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { data: tournaments, isLoading } = useTournaments();
  const { data: auth } = useAuth();
  const canManageTournaments = auth?.userRole === 'admin' || auth?.userRole === 'tournament_manager';
  const deleteTournament = useDeleteTournament();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await deleteTournament.mutateAsync(id);
      toast({ title: `✓ ${t("tournamentDeleted")}` });
      setDeletingId(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
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
    <Layout title={t("tournamentListTitle")}>
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("tournamentListTitle")}</h1>
        {canManageTournaments && (
          <Button onClick={() => setLocation("/tournaments/new")} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            {t("newTournament")}
          </Button>
        )}
      </div>

      {!tournaments || tournaments.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">{t("noTournamentsYet")}</p>
            {canManageTournaments && (
              <Button onClick={() => setLocation("/tournaments/new")}>
                {t("createFirstTournament")}
              </Button>
            )}
          </Card>
      ) : (
        <div className="grid gap-4">
          {tournaments.map((tournament, index) => {
            const hasBackground = Boolean(tournament.backgroundImageUrl);
            const fallbackBackground =
              fallbackTournamentBackgrounds[index % fallbackTournamentBackgrounds.length];

            return (
              <Card
                key={tournament.id}
                className={`relative min-h-[220px] overflow-hidden border-0 p-0 shadow-md transition-all hover:shadow-lg ${
                  hasBackground ? "bg-slate-950" : `bg-gradient-to-br ${fallbackBackground}`
                }`}
                onClick={() => setLocation(`/tournaments/${tournament.id}`)}
              >
                {hasBackground && (
                  <img
                    src={tournament.backgroundImageUrl || ""}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/45 to-black/70" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />

                <div className="relative z-10 flex min-h-[220px] cursor-pointer flex-col justify-between p-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-2xl font-bold leading-tight drop-shadow-sm">
                        {tournament.name}
                      </h2>
                      {tournament.description && (
                        <p className="mt-2 line-clamp-3 text-sm text-white/85">
                          {tournament.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge
                        className={
                          statusBadgeClasses[tournament.status] ||
                          "border-white/20 bg-white/90 text-slate-950"
                        }
                      >
                        {{
                          draft: t("draft"),
                          active: t("active"),
                          finished: t("finished"),
                        }[tournament.status] || tournament.status}
                      </Badge>
                      {tournament.tournamentType === "videogame" && (
                        <Badge className="border-white/20 bg-primary text-primary-foreground">
                          <Gamepad2 className="mr-1 h-3 w-3" />
                          {t("videogame")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-4 flex flex-wrap gap-3 text-sm text-white/85">
                      {tournament.startDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(tournament.startDate).toLocaleDateString(language === "es" ? "es-ES" : "en-US")}
                        </div>
                      )}
                      {tournament.endDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(tournament.endDate).toLocaleDateString(language === "es" ? "es-ES" : "en-US")}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="border-white/40 bg-white/95 text-slate-950 hover:bg-white"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/tournaments/${tournament.id}`);
                        }}
                      >
                        {t("viewDetails")}
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
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTournamentTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteTournamentDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("delete")}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </Layout>
  );
}
