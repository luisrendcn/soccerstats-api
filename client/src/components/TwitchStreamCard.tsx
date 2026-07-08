import { useQuery } from "@tanstack/react-query";
import { Radio, Tv } from "lucide-react";
import type { Match, Team, Tournament } from "@shared/schema";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MatchWithStream = Match & {
  homeTeam?: Team;
  awayTeam?: Team;
  tournament?: Tournament;
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

export function TwitchStreamCard({
  match,
  compact = false,
}: {
  match: MatchWithStream;
  compact?: boolean;
}) {
  const channel = getTwitchChannelFromMatch(match);
  const { data: streamStatus } = useQuery({
    queryKey: ["twitch-stream", channel],
    queryFn: async () => {
      const res = await apiFetch(`/api/twitch/streams/${channel}`);
      if (!res.ok) throw new Error("No se pudo consultar Twitch");
      return res.json() as Promise<{
        configured: boolean;
        isLive: boolean | null;
        stream: { title?: string; viewer_count?: number } | null;
      }>;
    },
    enabled: Boolean(channel),
    staleTime: 60_000,
    retry: false,
  });

  if (!channel) return null;

  const parent = encodeURIComponent(getTwitchParent());
  const embedUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}`;
  const isLive = match.status === "live" || streamStatus?.isLive === true;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Radio className={cn("h-4 w-4", isLive ? "text-red-500" : "text-primary")} />
            <h3 className="truncate font-display text-sm font-bold">
              {match.homeTeam?.name || "Equipo local"} vs {match.awayTeam?.name || "Equipo visitante"}
            </h3>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {match.tournament?.name ? `${match.tournament.name} · ` : ""}
            Twitch: @{channel}
          </p>
        </div>
        <Badge className={isLive ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary"}>
          {isLive ? "En vivo" : "Directo"}
        </Badge>
      </div>

      {!compact && (
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
        {streamStatus?.stream?.title && (
          <p className="text-sm font-medium">{streamStatus.stream.title}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {streamStatus?.configured === false && (
            <span>
              Estado automático pendiente: configura Twitch en Render para detectar si está en vivo.
            </span>
          )}
          {typeof streamStatus?.stream?.viewer_count === "number" && (
            <span>{streamStatus.stream.viewer_count} espectadores</span>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={`https://www.twitch.tv/${channel}`} target="_blank" rel="noreferrer">
            <Tv className="mr-2 h-4 w-4" />
            Abrir en Twitch
          </a>
        </Button>
      </div>
    </div>
  );
}
