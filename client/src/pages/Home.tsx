import { useMatches } from "@/hooks/use-matches";
import { useTeams } from "@/hooks/use-teams";
import { useTournaments } from "@/hooks/use-tournaments";
import { Layout } from "@/components/Layout";
import { MatchCard } from "@/components/MatchCard";
import { Trophy, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/i18n.tsx";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { t } = useLanguage();
  const { data: matchesResp, isLoading: matchesLoading } = useMatches();
  const { data: teamsResp, isLoading: teamsLoading } = useTeams();
  const { data: tournaments, isLoading: tournamentsLoading } = useTournaments();
  const { data: auth } = useAuth();
  const matches = matchesResp;
  const teams = teamsResp;

  const isLoading = matchesLoading || teamsLoading || tournamentsLoading;
  const enrichedMatches = matches
    ?.filter((match) => match.status === "finished")
    .map((match) => ({
      ...match,
      homeTeam: teams?.find((team) => team.id === match.homeTeamId),
      awayTeam: teams?.find((team) => team.id === match.awayTeamId),
      tournament: tournaments?.find(
        (tournament) => tournament.id === match.tournamentId,
      ),
    }))
    .filter((match) => match.homeTeam && match.awayTeam)
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
    .slice(0, 3);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout title={t('leagueOverview')}>
      {/* Recent Matches */}
      <section>
        {auth?.name && (
          <div className="mb-6 rounded-xl border border-primary/10 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground">Bienvenido</p>
            <h2 className="text-2xl font-display font-bold text-foreground">
              {auth.name}
            </h2>
            <p className="mt-1 text-xs uppercase tracking-wider text-primary">
              Rol: {auth.userRole}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display">{t('recentResults')}</h2>
          <Link href="/matches" className="text-xs text-primary font-bold uppercase tracking-wider hover:underline">{t('viewSchedule')}</Link>
        </div>
        
        <div className="space-y-4">
          {enrichedMatches?.map((match: any) => (
            <MatchCard key={match.id} match={match} showTournament />
          ))}
          
          {enrichedMatches?.length === 0 && (
            <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed border-border">
              <Trophy className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No matches played yet.</p>
              <Link href="/tournaments" className="mt-2 inline-block text-primary text-sm font-medium hover:underline">
                Ver torneos
              </Link>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
