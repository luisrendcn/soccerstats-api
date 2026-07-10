import { useState } from "react";
import { useMatches } from "@/hooks/use-matches";
import { useAuth } from "@/hooks/use-auth";
import { useTeams } from "@/hooks/use-teams";
import { api } from "@shared/routes";
import { Layout } from "@/components/Layout";
import { MatchCard } from "@/components/MatchCard";
import { Loader2, Radio, Trash } from "lucide-react";
import { useLanguage } from "@/lib/i18n.tsx";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { refreshAppData } from "@/lib/queryClient";
import {
  fetchTwitchStreamStatus,
  getTwitchChannelFromMatch,
  getTwitchStreamQueryKey,
  isTwitchStreamVisible,
  TwitchStreamCard,
} from "@/components/TwitchStreamCard";

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
  const [filter, setFilter] = useState<'live' | 'all' | 'scheduled' | 'finished'>('live');
  const { data: auth } = useAuth();
  const canDeleteMatches = auth?.userRole === "admin";
  const isLoading = matchesLoading || teamsLoading;

  const enrichedMatches = matches
    ?.map((match) => ({
      ...match,
      homeTeam: teams?.find((team) => team.id === match.homeTeamId),
      awayTeam: teams?.find((team) => team.id === match.awayTeamId),
    }))
    .filter((match) => match.homeTeam && match.awayTeam)
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

  const streamMatches = enrichedMatches?.filter(
    (match) => Boolean(getTwitchChannelFromMatch(match)),
  ) || [];
  const streamStatusQueries = useQueries({
    queries: streamMatches.map((match) => {
      const channel = getTwitchChannelFromMatch(match)!;
      return {
        queryKey: getTwitchStreamQueryKey(channel),
        queryFn: () => fetchTwitchStreamStatus(channel),
        staleTime: 60_000,
        refetchInterval: 60_000,
        retry: false,
      };
    }),
  });
  const liveMatches = streamMatches.filter((match, index) =>
    isTwitchStreamVisible(match, streamStatusQueries[index]?.data),
  );

  const filteredMatches = enrichedMatches?.filter((m: any) => {
    if (filter === 'live') {
      return liveMatches.some((match) => match.id === m.id);
    }
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const filterLabels: Record<'live' | 'all' | 'scheduled' | 'finished', string> = {
    live: t("live"),
    all: t('all'),
    scheduled: t('scheduled'),
    finished: t('finished'),
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <Layout title={t('matchSchedule')}>
      <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Radio className="h-5 w-5 text-red-500" />
              {t("liveMatches")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("liveMatchesDescription")}
            </p>
          </div>
          <span className="rounded-full bg-background px-3 py-1 text-xs font-bold text-primary shadow-sm">
            {liveMatches.length}
          </span>
        </div>
        {liveMatches.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {liveMatches.slice(0, 2).map((match: any) => (
              <TwitchStreamCard key={match.id} match={match} compact />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-background/70 p-4 text-center text-sm text-muted-foreground">
            {t("noLiveMatches")}
          </p>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex p-1 bg-muted/50 rounded-xl mb-6">
        {(['live', 'all', 'scheduled', 'finished'] as const).map((f) => (
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
        {filter === "live" &&
          filteredMatches?.map((match: any) => (
            <TwitchStreamCard key={match.id} match={match} />
          ))}

        {filter !== "live" && filteredMatches?.map((match: any) => (
          <div key={match.id} className="relative">
            <MatchCard match={match} />
            {canDeleteMatches && (
              <button title={t("deleteMatch")} className="absolute top-2 right-2 p-1 rounded-md bg-red-50 hover:bg-red-100" onClick={async () => {
                if (!confirm(t("deleteMatchConfirm"))) return;
                const response = await apiFetch(`/api/matches/${match.id}`, { method: "DELETE" });
                if (!response.ok) throw new Error(t("deleteMatchFailed"));
                await refreshAppData(queryClient);
              }}>
                <Trash className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        ))}

        {filteredMatches?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('noMatches')}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {t("newMatchesFromTournament")}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
