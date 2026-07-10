import { format } from "date-fns";
import { Link } from "wouter";
import { Team, Match, Tournament } from "@shared/schema";
import { useLanguage } from "@/lib/i18n.tsx";

type MatchWithTeams = Match & {
  homeTeam?: Team;
  awayTeam?: Team;
  tournament?: Tournament;
};

interface MatchCardProps {
  match: MatchWithTeams;
  showDate?: boolean;
  showTournament?: boolean;
}

export function MatchCard({
  match,
  showDate = true,
  showTournament = false,
}: MatchCardProps) {
  const { t } = useLanguage();
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const statusLabel =
    isLive ? t("live") : match.status === "finished" ? t("finished") : t("scheduled");

  return (
    <Link href={`/matches/${match.id}`}>
      <div className="group relative overflow-hidden bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 cursor-pointer">
        {/* Status Stripe */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${isFinished ? 'bg-muted-foreground/30' : isLive ? 'bg-red-500' : 'bg-primary'}`} />
        
        <div className="p-4 pl-6">
          {showDate && (
            <div className="mb-3 flex justify-between items-center text-xs text-muted-foreground font-mono">
              <div className="flex min-w-0 items-center gap-2">
                <span>{format(new Date(match.date), "EEE, MMM d • HH:mm")}</span>
                {showTournament && (
                  <span className="truncate rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {match.tournament?.name || t("assignedTournamentMissing")}
                  </span>
                )}
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isFinished ? 'bg-muted text-muted-foreground' : isLive ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'}`}>
                {statusLabel}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            {/* Home Team */}
            <div className="flex-1 flex flex-col items-start gap-1">
              <span className="font-display font-bold text-lg leading-tight truncate w-full" style={{ color: match.homeTeam?.color || 'inherit' }}>
                {match.homeTeam?.name || t("unknown")}
              </span>
            </div>

            {/* Score */}
            <div className="flex items-center gap-3 px-3 py-1 bg-muted/30 rounded-lg font-mono font-bold text-xl min-w-[80px] justify-center">
              <span className={isFinished ? "text-foreground" : "text-muted-foreground"}>
                {match.homeScore}
              </span>
              <span className="text-muted-foreground/50 text-sm">:</span>
              <span className={isFinished ? "text-foreground" : "text-muted-foreground"}>
                {match.awayScore}
              </span>
            </div>

            {/* Away Team */}
            <div className="flex-1 flex flex-col items-end gap-1 text-right">
              <span className="font-display font-bold text-lg leading-tight truncate w-full" style={{ color: match.awayTeam?.color || 'inherit' }}>
                {match.awayTeam?.name || t("unknown")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
