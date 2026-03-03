import { useState } from "react";
import { useMatches, useCreateMatch } from "@/hooks/use-matches";
import { useAuth } from "@/hooks/use-auth";
import { useTeams } from "@/hooks/use-teams";
import { api } from "@shared/routes";
import { Layout } from "@/components/Layout";
import { MatchCard } from "@/components/MatchCard";
import { Loader2, Plus, Trash } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n.tsx";
import { useQueryClient } from "@tanstack/react-query";

export default function Matches() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { data: matchesResp, isLoading: matchesLoading } = useMatches(page, 10, search);
  const { data: teamsResp, isLoading: teamsLoading } = useTeams();
  const matches = matchesResp;
  const totalPages = 1; // Single page for now
  const teams = teamsResp;
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'finished'>('all');
  const { data: auth } = useAuth();
  const isPublic = auth?.userRole === 'public';
  const canCreateMatch = auth?.userRole === 'admin' || auth?.userRole === 'tournament_manager';

  const isLoading = matchesLoading || teamsLoading;

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  // Enrich matches with team data
  const enrichedMatches = matches?.map((m: any) => ({
    ...m,
    homeTeam: teams?.find((t: any) => t.id === m.homeTeamId),
    awayTeam: teams?.find((t: any) => t.id === m.awayTeamId),
  }))?.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredMatches = enrichedMatches?.filter((m: any) => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const filterLabels: Record<'all' | 'scheduled' | 'finished', string> = {
    all: t('all'),
    scheduled: t('scheduled'),
    finished: t('finished'),
  };

  return (
    <Layout title={t('matchSchedule')}>
      {/* Filter Tabs */}
      <div className="flex p-1 bg-muted/50 rounded-xl mb-6">
        {(['all', 'scheduled', 'finished'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              filter === f ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      <div className="space-y-4 mb-20">
        {filteredMatches?.map((match: any) => (
          <div key={match.id} className="relative">
            <MatchCard match={match} />
            {!isPublic && (
              <button title="Delete match" className="absolute top-2 right-2 p-1 rounded-md bg-red-50 hover:bg-red-100" onClick={async () => {
                if (!confirm('Delete this match?')) return;
                await fetch(`/api/matches/${match.id}`, { method: 'DELETE', credentials: 'include' });
                queryClient.invalidateQueries({ queryKey: [api.matches.list.path] });
              }}>
                <Trash className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        ))}

        {filteredMatches?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">{t('noMatches')}</p>
            {canCreateMatch && (
              <Link href="/matches/new">
                <Button>{t('scheduleAMatch')}</Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
