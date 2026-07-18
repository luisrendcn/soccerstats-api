import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/i18n.tsx";
import type { ClassicWorldCupSummary } from "@/hooks/use-tournaments";

type Props = {
  summary?: ClassicWorldCupSummary;
  isLoading?: boolean;
  canManage?: boolean;
  onGenerateRoundOf16?: () => void;
  isGeneratingRoundOf16?: boolean;
};

const knockoutPhases = [
  "round_of_16",
  "quarterfinals",
  "semifinals",
  "third_place",
  "final",
] as const;

function formatScore(match: any) {
  if (match.status !== "finished") return "-";
  const score = `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`;
  if (
    typeof match.penaltyHomeScore === "number" &&
    typeof match.penaltyAwayScore === "number"
  ) {
    return `${score} (P ${match.penaltyHomeScore}-${match.penaltyAwayScore})`;
  }
  return score;
}

export function ClassicWorldCupView({
  summary,
  isLoading,
  canManage,
  onGenerateRoundOf16,
  isGeneratingRoundOf16,
}: Props) {
  const { t, language } = useLanguage();
  if (isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>;
  }
  if (!summary) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t("worldCupNotGenerated")}
      </p>
    );
  }

  const teamById = new Map(
    summary.groups.flatMap((group) => group.teams.map((team) => [team.id, team] as const)),
  );
  const groupMatches = summary.groups.flatMap((group) => group.matches);
  const roundOf16Ready =
    summary.groups.length === 8 &&
    summary.groups.every((group) =>
      group.matches.length === 6 &&
      group.matches.every((match) => match.status === "finished") &&
      group.standings.slice(0, 2).every((standing) => !standing.unresolvedTie),
    );
  const roundOf16AlreadyFilled = summary.knockoutMatches.some(
    (match) => match.tournamentPhase === "round_of_16" && match.homeTeamId && match.awayTeamId,
  );
  const nameOf = (teamId?: number | null, fallback?: string | null) =>
    teamId ? teamById.get(teamId)?.name || t("teamFallback") : fallback || t("pending");

  return (
    <Tabs defaultValue="summary" className="space-y-4">
      <TabsList className="grid h-auto grid-cols-3 gap-1 sm:grid-cols-5">
        <TabsTrigger value="summary">{t("summary")}</TabsTrigger>
        <TabsTrigger value="groups">{t("groups")}</TabsTrigger>
        <TabsTrigger value="matches">{t("matches")}</TabsTrigger>
        <TabsTrigger value="knockout">{t("knockout")}</TabsTrigger>
        <TabsTrigger value="finalTable">{t("finalClassification")}</TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">{t("groups")}</p>
            <p className="text-xl font-bold">{summary.groups.length}/8</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">{t("teams")}</p>
            <p className="text-xl font-bold">{teamById.size}/32</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">{t("groupStage")}</p>
            <p className="text-xl font-bold">{groupMatches.length}/48</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">{t("knockout")}</p>
            <p className="text-xl font-bold">{summary.knockoutMatches.length}/16</p>
          </Card>
        </div>
        {canManage && roundOf16Ready && !roundOf16AlreadyFilled && (
          <Button
            className="w-full"
            onClick={onGenerateRoundOf16}
            disabled={isGeneratingRoundOf16}
          >
            {t("generateRoundOf16")}
          </Button>
        )}
      </TabsContent>

      <TabsContent value="groups" className="space-y-4">
        {summary.groups.map((group) => (
          <Card key={group.id} className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-base font-bold">
                {t("groupLabel", { group: group.name })}
              </h3>
              <Badge variant="outline">{group.status}</Badge>
            </div>
            <table className="w-full table-fixed text-[10px]">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[32%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="text-muted-foreground">
                <tr>
                  <th>#</th>
                  <th className="text-left">{t("teamsTitle")}</th>
                  <th>PJ</th>
                  <th>PG</th>
                  <th>PE</th>
                  <th>PP</th>
                  <th>DG</th>
                  <th>GF</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {group.standings.map((standing) => (
                  <tr
                    key={standing.teamId}
                    className={standing.position <= 2 ? "bg-primary/5" : ""}
                  >
                    <td className="py-1 text-center">{standing.position}</td>
                    <td className="truncate py-1 font-medium">{standing.teamName}</td>
                    <td className="text-center">{standing.played}</td>
                    <td className="text-center">{standing.wins}</td>
                    <td className="text-center">{standing.draws}</td>
                    <td className="text-center">{standing.losses}</td>
                    <td className="text-center">{standing.goalDifference}</td>
                    <td className="text-center">{standing.goalsFor}</td>
                    <td className="text-center font-bold">{standing.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {group.standings.some((standing) => standing.unresolvedTie) && (
              <p className="mt-2 text-xs text-amber-700">
                {t("manualTieBreakRequired")}
              </p>
            )}
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="matches" className="space-y-3">
        {groupMatches.map((match) => (
          <Link key={match.id} href={`/matches/${match.id}`}>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{nameOf(match.homeTeamId)}</span>
                <span className="font-mono font-bold">{formatScore(match)}</span>
                <span className="truncate text-right">{nameOf(match.awayTeamId)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("round")} {match.roundNumber} · {new Date(match.date).toLocaleString(language === "es" ? "es-CO" : "en-US")}
              </p>
            </div>
          </Link>
        ))}
      </TabsContent>

      <TabsContent value="knockout">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {knockoutPhases.map((phase) => {
            const phaseMatches = summary.knockoutMatches.filter(
              (match) => match.tournamentPhase === phase,
            );
            return (
              <div key={phase} className="min-w-64 flex-1 space-y-2">
                <h3 className="text-sm font-bold">{t(phase)}</h3>
                {phaseMatches.map((match) => (
                  <Link key={match.id} href={`/matches/${match.id}`}>
                    <div className="rounded-lg border border-border bg-card p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className={match.winnerTeamId === match.homeTeamId ? "font-bold text-primary" : "truncate"}>
                          {nameOf(match.homeTeamId, match.homeSourceType)}
                        </span>
                        <span className="font-mono">{formatScore(match)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={match.winnerTeamId === match.awayTeamId ? "font-bold text-primary" : "truncate"}>
                          {nameOf(match.awayTeamId, match.awaySourceType)}
                        </span>
                        <Badge variant="outline">{match.status}</Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="finalTable" className="space-y-2">
        {[
          [t("champion"), summary.finalClassification.championTeamId],
          [t("runnerUp"), summary.finalClassification.runnerUpTeamId],
          [t("thirdPlace"), summary.finalClassification.thirdPlaceTeamId],
          [t("fourthPlace"), summary.finalClassification.fourthPlaceTeamId],
        ].map(([label, teamId]) => (
          <div key={String(label)} className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="font-semibold">{nameOf(teamId as number | null)}</span>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}
