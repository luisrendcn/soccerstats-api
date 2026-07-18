import { useState } from "react";
import { useDeleteTeam, useTeams } from "@/hooks/use-teams";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/Layout";
import { TeamColorGradientBackground, TeamColorCircle } from "@/components/TeamColor";
import { Link } from "wouter";
import { Gamepad2, Loader2, Users, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n.tsx";
import { useToast } from "@/hooks/use-toast";

export default function Teams() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data: teamsResp, isFetching, isLoading } = useTeams(page, 10, search);
  const deleteTeam = useDeleteTeam();
  const teams = teamsResp;
  const totalPages = 1; // Single page for now
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: auth } = useAuth();
  const normalizedSearch = search.trim().toLowerCase();
  const visibleTeams = normalizedSearch
    ? teams?.filter((team: any) =>
        team.name?.toLowerCase().includes(normalizedSearch),
      )
    : teams;

  return (
    <Layout title={t('teamsTitle')}>
      <div className="mb-24 space-y-4">
        <div className="sticky top-[73px] z-30 bg-muted/10 pb-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Input
              placeholder={t("searchTeams")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="flex-1"
            />
            {isFetching && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            )}
          </div>
        </div>

        {isLoading && !teams?.length ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visibleTeams?.map((team: any) => (
              <div key={team.id} className="relative">
                <Link href={`/teams/${team.id}`}>
                  <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group relative overflow-hidden h-full flex flex-col justify-between min-h-[160px]">
                    <TeamColorGradientBackground color={team.color} />

                    <div>
                      <TeamColorCircle color={team.color} />
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="font-display font-bold text-xl leading-tight">{team.name}</h3>
                        {team.isVideogameTournamentTeam && (
                          <Badge className="bg-primary/10 text-primary">
                            <Gamepad2 className="mr-1 h-3 w-3" />
                            {t("videogameTournament")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {team.isVideogameTournamentTeam
                          ? t("videogameTeamSummary")
                          : t('tapToViewRoster')}
                      </p>
                    </div>

                    <div className="flex justify-end mt-4">
                       <Users className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary/50" />
                    </div>
                  </div>
                </Link>
                {auth?.userRole === 'admin' && (
                  <button title={t("deleteTeamConfirm", { name: team.name })} className="absolute top-2 right-2 p-2 rounded-md bg-red-50 hover:bg-red-100" onClick={async (e) => { e.preventDefault(); if (!confirm(t("deleteTeamConfirm", { name: team.name }))) return; await deleteTeam.mutateAsync(team.id).catch(() => toast({ variant: "destructive", title: t("error"), description: t("deleteTeamFailed") })); }}>
                    <Trash className="w-4 h-4 text-red-600" />
                  </button>
                )}
              </div>
            ))}
            {visibleTeams?.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground sm:col-span-2">
                {t("noTeamsRegistered")}
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <Button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>{t("previous")}</Button>
          <div className="text-sm text-muted-foreground">{t("pageOf", { page, totalPages })}</div>
          <Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t("next")}</Button>
        </div>
      </div>
    </Layout>
  );
}
