import { useMatches } from "@/hooks/use-matches";
import { useTeams } from "@/hooks/use-teams";
import { Layout } from "@/components/Layout";
import { TeamColorBadge } from "@/components/TeamColor";
import { MatchCard } from "@/components/MatchCard";
import { Trophy, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n.tsx";

export default function Home() {
  const { t } = useLanguage();
  const { data: matchesResp, isLoading: matchesLoading } = useMatches();
  const { data: teamsResp, isLoading: teamsLoading } = useTeams();
  const matches = matchesResp;
  const teams = teamsResp;

  const isLoading = matchesLoading || teamsLoading;
  const { data: auth } = useAuth();
  const isPublic = auth?.userRole === 'public';
  const canCreateMatch = auth?.userRole === 'admin' || auth?.userRole === 'tournament_manager';

  // Calculate Standings
  const standings = teams?.map((team: any) => {
    const teamMatches = matches?.filter((m: any) => 
      m.status === 'finished' && (m.homeTeamId === team.id || m.awayTeamId === team.id)
    ) || [];

    let points = 0;
    let played = 0;
    let gd = 0;

    teamMatches.forEach((m: any) => {
      played++;
      const isHome = m.homeTeamId === team.id;
      const goalsFor = isHome ? (m.homeScore || 0) : (m.awayScore || 0);
      const goalsAgainst = isHome ? (m.awayScore || 0) : (m.homeScore || 0);
      
      gd += (goalsFor - goalsAgainst);

      if (goalsFor > goalsAgainst) points += 3;
      else if (goalsFor === goalsAgainst) points += 1;
    });

    return { ...team, points, played, gd };
  }).sort((a: any, b: any) => b.points - a.points || b.gd - a.gd);

  // Get recent finished matches
  const recentMatches = matches
    ?.filter((m: any) => m.status === "finished")
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  // Enrich matches with team data
  const enrichedMatches = recentMatches?.map((m: any) => ({
    ...m,
    homeTeam: teams?.find((t: any) => t.id === m.homeTeamId),
    awayTeam: teams?.find((t: any) => t.id === m.awayTeamId),
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout title={t('leagueOverview')}>
      {/* Standings Table */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display">
            {t('standings')} <span className="text-xs text-muted-foreground">(todos los torneos)</span>
          </h2>
          <Link href="/teams" className="text-xs text-primary font-bold uppercase tracking-wider hover:underline">{t('viewAllTeams')}</Link>
        </div>
        
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase font-mono text-muted-foreground border-b border-border/50">
              <tr>
                <th className="px-4 py-3 text-left w-12">#</th>
                <th className="px-2 py-3 text-left">Team</th>
                <th className="px-2 py-3 text-center w-10">P</th>
                <th className="px-2 py-3 text-center w-10">GD</th>
                <th className="px-4 py-3 text-center w-12 font-bold text-foreground">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {standings?.map((team: any, index: any) => (
                <tr key={team.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-muted-foreground">{index + 1}</td>
                  <td className="px-2 py-3 font-bold truncate max-w-[120px]">
                    <div className="flex items-center gap-2">
                      <TeamColorBadge color={team.color} />
                      {team.name}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center text-muted-foreground">{team.played}</td>
                  <td className="px-2 py-3 text-center text-muted-foreground">{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                  <td className="px-4 py-3 text-center font-bold text-base">{team.points}</td>
                </tr>
              ))}
              {standings?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                    {t('noTeamsRegistered')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Matches */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display">{t('recentResults')}</h2>
          <Link href="/matches" className="text-xs text-primary font-bold uppercase tracking-wider hover:underline">{t('viewSchedule')}</Link>
        </div>
        
        <div className="space-y-4">
          {enrichedMatches?.map((match: any) => (
            <MatchCard key={match.id} match={match} />
          ))}
          
          {enrichedMatches?.length === 0 && (
            <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed border-border">
              <Trophy className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No matches played yet.</p>
              {canCreateMatch && (
                <Link href="/matches/new" className="mt-2 inline-block text-primary text-sm font-medium hover:underline">
                  Schedule a Match
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
