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

interface CreateMatchProps {
  tournamentId: number;
}

export default function CreateMatch({ tournamentId }: CreateMatchProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeamId || !awayTeamId || !date || !time) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in all required fields." });
      return;
    }

    if (homeTeamId === awayTeamId) {
      toast({ variant: "destructive", title: "Invalid Matchup", description: "Home and Away teams must be different." });
      return;
    }

    try {
      // Combine date and time
      const dateTime = new Date(`${date}T${time}`);
      
      await createMatch.mutateAsync({
        tournamentId,
        homeTeamId: parseInt(homeTeamId),
        awayTeamId: parseInt(awayTeamId),
        date: dateTime,
        location: locationName || "Main Field",
        status,
        streamPlatform: streamChannel.trim() ? "twitch" : null,
        streamChannel: streamChannel.trim() || null,
        streamUrl: streamChannel.trim() || null,
      });
      
      toast({ title: "Match Scheduled!", description: "The match has been successfully created." });
      setLocation(`/tournaments/${tournamentId}`);
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: (err as Error).message });
    }
  };

  if (tournamentLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <Layout title={`Nuevo Partido - ${tournament?.name || "Torneo"}`} showBack>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
          <div className="space-y-1">
            <Label>Torneo</Label>
            <p className="font-semibold">{tournament?.name}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Home Team</Label>
              <Select value={homeTeamId} onValueChange={setHomeTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {tournamentTeams?.map((team) => (
                    <SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Away Team</Label>
              <Select value={awayTeamId} onValueChange={setAwayTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
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
            <p className="text-sm text-muted-foreground">Cargando equipos del torneo...</p>
          )}
          {!tournamentTeamsLoading && tournamentTeams?.length === 0 && (
            <p className="text-sm text-destructive">
              Este torneo todavía no tiene equipos inscritos.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Input 
              placeholder="Ej. Estadio, sala o lobby del juego"
              value={locationName} 
              onChange={e => setLocationName(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Estado inicial</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as "scheduled" | "live")}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Programado</SelectItem>
                  <SelectItem value="live">En vivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Canal o URL de Twitch</Label>
              <Input
                placeholder="Ej. efootball_colombia o https://twitch.tv/..."
                value={streamChannel}
                onChange={(e) => setStreamChannel(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Para gameplays como eFootball, inicia el directo en Twitch y pega aquí el canal. Soccer Stats mostrará el reproductor en partidos en vivo.
          </p>

        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full font-bold text-lg h-12 shadow-lg shadow-primary/20"
          disabled={createMatch.isPending || (tournamentTeams?.length || 0) < 2}
        >
          {createMatch.isPending ? "Scheduling..." : "Create Match"}
        </Button>
      </form>
    </Layout>
  );
}
