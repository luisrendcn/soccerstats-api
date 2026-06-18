import { useEffect, useState } from "react";
import { useBootstrap } from "@/hooks/use-bootstrap";
import { Layout } from "@/components/Layout";
import { MatchCard } from "@/components/MatchCard";
import { Trophy, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/i18n.tsx";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { t } = useLanguage();
  const { data: bootstrap, isLoading, isFetching } = useBootstrap();
  const { data: auth } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const matches = bootstrap?.matches;
  const teams = bootstrap?.teams;
  const tournaments = bootstrap?.tournaments;
  const roleLabel = (role: string) =>
    ({
      admin: "Administrador",
      tournament_manager: "Gestor de torneos",
      team_captain: "Capitán/Líder de equipo",
      team: "Capitán/Líder de equipo",
      referee: "Árbitro",
      public: "Público",
    } as Record<string, string>)[role] || role;

  useEffect(() => {
    if (!auth?.name) return;

    setShowWelcome(true);
    const timeout = window.setTimeout(() => {
      setShowWelcome(false);
    }, 6000);

    return () => window.clearTimeout(timeout);
  }, [auth?.name]);

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

  if (isLoading && !bootstrap) {
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
        {showWelcome && auth?.name && (
          <div className="mb-6 rounded-xl border border-primary/10 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground">Bienvenido</p>
            <h2 className="text-2xl font-display font-bold text-foreground">
              {auth.name}
            </h2>
            <p className="mt-1 text-xs uppercase tracking-wider text-primary">
              Rol: {roleLabel(auth.userRole)}
            </p>
          </div>
        )}

        {!auth && (
          <div className="mb-6 rounded-xl border border-primary/10 bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold text-foreground">
              Estás navegando como público
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Puedes ver torneos, equipos, calendario y resultados. Si quieres
              cumplir un rol como gestor de torneos, capitán/líder de equipo
              o árbitro, comunícate con el administrador al 3507803134 o
              solicita acceso.
            </p>
            <Link
              href="/register"
              className="mt-3 inline-block text-sm font-bold text-primary hover:underline"
            >
              Solicitar un rol
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display">{t('recentResults')}</h2>
          <Link href="/matches" className="text-xs text-primary font-bold uppercase tracking-wider hover:underline">{t('viewSchedule')}</Link>
        </div>
        {isFetching && bootstrap && (
          <p className="mb-3 text-xs text-muted-foreground">
            Actualizando datos recientes...
          </p>
        )}
        
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
