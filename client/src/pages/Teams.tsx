import { useState } from "react";
import { useTeams } from "@/hooks/use-teams";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { TeamColorGradientBackground, TeamColorCircle } from "@/components/TeamColor";
import { Link } from "wouter";
import { Gamepad2, Loader2, Users, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n.tsx";
import { apiFetch } from "@/lib/api";
import { refreshAppData } from "@/lib/queryClient";

export default function Teams() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { data: teamsResp, isLoading } = useTeams(page, 10, search);
  const teams = teamsResp;
  const totalPages = 1; // Single page for now
  const { t } = useLanguage();
  const { data: auth } = useAuth();

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <Layout title={t('teamsTitle')}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-24">
        {/* Team Cards */}
        <div className="flex items-center gap-2 mb-4">
          <Input placeholder="Search teams..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
        </div>
        {teams?.map((team: any) => (
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
                        Torneo de videojuego
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {team.isVideogameTournamentTeam
                      ? "Equipo inscrito en torneo de videojuego"
                      : t('tapToViewRoster')}
                  </p>
                </div>
                
                <div className="flex justify-end mt-4">
                   <Users className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary/50" />
                </div>
              </div>
            </Link>
            {auth?.userRole === 'admin' && (
              <button title={`Delete ${team.name}`} className="absolute top-2 right-2 p-2 rounded-md bg-red-50 hover:bg-red-100" onClick={async (e) => { e.preventDefault(); if (!confirm(`Delete ${team.name}?`)) return; const response = await apiFetch(`/api/teams/${team.id}`, { method: "DELETE" }); if (!response.ok) throw new Error("Failed to delete team"); await refreshAppData(queryClient); }}>
                <Trash className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        ))}

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <Button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
          <div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
          <Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    </Layout>
  );
}
