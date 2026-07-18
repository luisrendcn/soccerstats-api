import { useQuery } from "@tanstack/react-query";
import { Radio, Tv } from "lucide-react";
import type { Match, Team, Tournament } from "@shared/schema";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n.tsx";

type MatchWithStream = Match & {
  homeTeam?: Team;
  awayTeam?: Team;
  tournament?: Tournament;
};

export type TwitchStreamStatus = {
  configured: boolean;
  isLive: boolean | null;
  stream: { title?: string; viewer_count?: number } | null;
  offlineSince?: string | null;
  graceExpiresAt?: string | null;
  lastLiveAt?: string | null;
  hasBeenLive?: boolean;
};

function normalizeTwitchChannel(value?: string | null) {
  const input = value?.trim();
  if (!input) return null;
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "twitch.tv" && host !== "m.twitch.tv") return null;
    return url.pathname.split("/").filter(Boolean)[0] || null;
  } catch {
    return input.replace(/^@/, "");
  }
}

function getTwitchParent() {
  if (typeof window === "undefined") return "localhost";
  return window.location.hostname || "localhost";
}

export function getTwitchChannelFromMatch(match: MatchWithStream) {
  return normalizeTwitchChannel(match.streamChannel || match.streamUrl);
}

export function getTwitchStreamQueryKey(channel: string | null, matchId?: number) {
  return ["twitch-stream", channel, matchId ?? null];
}

export async function fetchTwitchStreamStatus(channel: string, matchId?: number) {
  const suffix = matchId ? `?matchId=${matchId}` : "";
  const res = await apiFetch(`/api/twitch/streams/${channel}${suffix}`);
  if (!res.ok) throw new Error("Could not check Twitch");
  return res.json() as Promise<TwitchStreamStatus>;
}

export function isTwitchStreamVisible(
  match: MatchWithStream,
  streamStatus?: TwitchStreamStatus,
) {
  if (!getTwitchChannelFromMatch(match)) return false;
  if (match.status !== "live") return false;

  if (!streamStatus) {
    return true;
  }

  if (streamStatus.configured === false) {
    return true;
  }

  if (streamStatus.isLive === true) {
    return true;
  }

  if (streamStatus.hasBeenLive === true) {
    return false;
  }

  return true;
}

export function TwitchStreamCard({
  match,
  compact = false,
}: {
  match: MatchWithStream;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const channel = getTwitchChannelFromMatch(match);
  const { data: streamStatus } = useQuery({
    queryKey: getTwitchStreamQueryKey(channel, match.id),
    queryFn: () => fetchTwitchStreamStatus(channel!, match.id),
    enabled: Boolean(channel) && match.status === "live",
    staleTime: 15_000,
    refetchInterval: 15_000,
    retry: false,
  });

  if (!channel) return null;
  if (!isTwitchStreamVisible(match, streamStatus)) return null;

  const parent = encodeURIComponent(getTwitchParent());
  const embedUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}`;
  const isLive =
    streamStatus?.isLive === true ||
    (streamStatus?.configured !== true && match.status === "live");
  const isRecentlyOffline =
    streamStatus?.configured === true &&
    streamStatus.isLive === false &&
    streamStatus.hasBeenLive === true;
  const isWaitingForTwitch =
    streamStatus?.configured === true &&
    streamStatus.isLive === false &&
    streamStatus.hasBeenLive !== true;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Radio className={cn("h-4 w-4", isLive ? "text-red-500" : "text-primary")} />
            <h3 className="truncate font-display text-sm font-bold">
              {match.homeTeam?.name || t("localTeam")} vs {match.awayTeam?.name || t("awayTeamLabel")}
            </h3>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {match.tournament?.name ? `${match.tournament.name} · ` : ""}
            Twitch: @{channel}
          </p>
        </div>
        <Badge className={isLive ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary"}>
          {isLive ? t("live") : isRecentlyOffline ? t("recentlyFinished") : t("direct")}
        </Badge>
      </div>

      {!compact && isLive && (
        <div className="aspect-video w-full bg-black">
          <iframe
            className="h-full w-full"
            src={embedUrl}
            title={`Twitch ${channel}`}
            allowFullScreen
            loading="lazy"
          />
        </div>
      )}

      <div className="space-y-3 p-4">
        {isRecentlyOffline && (
          <p className="text-sm text-muted-foreground">
            {t("streamOffline")}
          </p>
        )}
        {isWaitingForTwitch && (
          <p className="text-sm text-muted-foreground">
            {t("streamWaitingLive")}
          </p>
        )}
        {streamStatus?.stream?.title && (
          <p className="text-sm font-medium">{streamStatus.stream.title}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {streamStatus?.configured === false && (
            <span>
              {t("automaticStatusPending")}
            </span>
          )}
          {typeof streamStatus?.stream?.viewer_count === "number" && (
            <span>{t("viewers", { count: streamStatus.stream.viewer_count })}</span>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={`https://www.twitch.tv/${channel}`} target="_blank" rel="noreferrer">
            <Tv className="mr-2 h-4 w-4" />
            {t("openInTwitch")}
          </a>
        </Button>
      </div>
    </div>
  );
}
