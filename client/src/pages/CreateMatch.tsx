import { useState } from "react";
import { useLocation } from "wouter";
import { useTournament, useTournamentTeams } from "@/hooks/use-tournaments";
import { useCreateMatch } from "@/hooks/use-matches";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n.tsx";
import { APP_TIME_ZONE } from "@shared/time";

interface CreateMatchProps {
  tournamentId: number;
}

export default function CreateMatch({ tournamentId }: CreateMatchProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: tournament, isLoading: tournamentLoading } = useTournament(tournamentId);
  const createMatch = useCreateMatch();

  const [homeTeamId, setHomeTeamId] = useState<string>("");
  const [awayTeamId, setAwayTeamId] = useState<string>("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [status, setStatus] = useState<"scheduled" | "live">("scheduled");
  const [streamChannel, setStreamChannel] = useState("");
  const {
    data: tournamentTeams,
    isLoading: tournamentTeamsLoading,
  } = useTournamentTeams(tournamentId);
  const isVideogameTournament = tournament?.tournamentType === "videogame";
  const selectedMatchTeams = tournamentTeams?.filter((team) =>
    [homeTeamId, awayTeamId].includes(String(team.id)),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeamId || !awayTeamId || !date || !time) {
      toast({ variant: "destructive", title: t("missingFields"), description: t("fillRequiredFields") });
      return;
    }

    if (homeTeamId === awayTeamId) {
      toast({ variant: "destructive", title: t("invalidMatchup"), description: t("differentTeamsRequired") });
      return;
    }
    if (isVideogameTournament) {
      const teamsWithoutTwitch =
        selectedMatchTeams?.filter((team) => !team.twitchChannel) || [];
      if (teamsWithoutTwitch.length > 0) {
        toast({
          variant: "destructive",
          title: t("missingTwitchChannel"),
          description: t("bothTeamsNeedTwitch"),
        });
        return;
      }
      if (!streamChannel) {
        toast({
          variant: "destructive",
          title: t("channelRequired"),
          description: t("selectBroadcastChannel"),
        });
        return;
      }
    }

    try {
      // Combine date and time
      const dateTime = new Date(`${date}T${time}`);
      
      await createMatch.mutateAsync({
        tournamentId,
        homeTeamId: parseInt(homeTeamId),
        awayTeamId: parseInt(awayTeamId),
        date: dateTime,
        scheduledDate: date,
        scheduledTime: time,
        timeZone: APP_TIME_ZONE,
        location: locationName || t("mainField"),
        status,
        streamPlatform: isVideogameTournament ? "twitch" : null,
        streamChannel: isVideogameTournament ? streamChannel : null,
        streamUrl: isVideogameTournament ? streamChannel : null,
      });
      
      toast({ title: t("matchScheduled"), description: t("matchCreatedSuccess") });
      setLocation(`/tournaments/${tournamentId}`);
    } catch (err) {
      toast({ variant: "destructive", title: t("error"), description: t("unexpectedError") });
    }
  };

  if (tournamentLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <Layout title={t("newMatchTitle", { tournament: tournament?.name || t("tournament") })} showBack>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
          <div className="space-y-1">
            <Label>{t("tournamentLabel")}</Label>
            <p className="font-semibold">{tournament?.name}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("homeTeam")}</Label>
              <Select
                value={homeTeamId}
                onValueChange={(value) => {
                  setHomeTeamId(value);
                  setStreamChannel("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("select")} />
                </SelectTrigger>
                <SelectContent>
                  {tournamentTeams?.map((team) => (
                    <SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("awayTeam")}</Label>
              <Select
                value={awayTeamId}
                onValueChange={(value) => {
                  setAwayTeamId(value);
                  setStreamChannel("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("select")} />
                </SelectTrigger>
                <SelectContent>
                  {tournamentTeams?.map((team) => (
                    <SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tournamentTeamsLoading && (
            <p className="text-sm text-muted-foreground">{t("loadingTournamentTeams")}</p>
          )}
          {!tournamentTeamsLoading && tournamentTeams?.length === 0 && (
            <p className="text-sm text-destructive">
              {t("tournamentHasNoTeams")}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("time")}</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("location")}</Label>
            <Input 
              placeholder={t("locationPlaceholder")}
              value={locationName} 
              onChange={e => setLocationName(e.target.value)} 
            />
          </div>

          <div className="space-y-2">
            <Label>{t("initialStatus")}</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as "scheduled" | "live")}>
              <SelectTrigger>
                <SelectValue placeholder={t("status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">{t("scheduled")}</SelectItem>
                <SelectItem value="live">{t("live")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isVideogameTournament && (
            <div className="space-y-2">
              <Label>{t("broadcastChannel")}</Label>
              <Select
                value={streamChannel}
                onValueChange={setStreamChannel}
                disabled={!homeTeamId || !awayTeamId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectTwitchChannel")} />
                </SelectTrigger>
                <SelectContent>
                  {selectedMatchTeams?.map((team) => (
                    <SelectItem
                      key={team.id}
                      value={team.twitchChannel || String(team.id)}
                      disabled={!team.twitchChannel}
                    >
                      {team.name} - @{team.twitchChannel || t("noChannel")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("channelsFromVideogameParticipants")}
              </p>
            </div>
          )}

          {!isVideogameTournament && (
            <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              {t("twitchEnabledForVideogameTournaments")}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full font-bold text-lg h-12 shadow-lg shadow-primary/20"
          disabled={
            createMatch.isPending ||
            (tournamentTeams?.length || 0) < 2 ||
            (isVideogameTournament && !streamChannel)
          }
        >
          {createMatch.isPending ? t("scheduling") : t("createMatch")}
        </Button>
      </form>
    </Layout>
  );
}
