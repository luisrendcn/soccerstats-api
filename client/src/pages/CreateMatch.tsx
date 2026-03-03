import { useState } from "react";
import { useLocation } from "wouter";
import { useTeams } from "@/hooks/use-teams";
import { useCreateMatch } from "@/hooks/use-matches";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function CreateMatch() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: teamsResp, isLoading } = useTeams();
  const teams = teamsResp;
  const createMatch = useCreateMatch();

  const [homeTeamId, setHomeTeamId] = useState<string>("");
  const [awayTeamId, setAwayTeamId] = useState<string>("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [locationName, setLocationName] = useState("");

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
        homeTeamId: parseInt(homeTeamId),
        awayTeamId: parseInt(awayTeamId),
        date: dateTime,
        location: locationName || "Main Field",
        status: "scheduled"
      });
      
      toast({ title: "Match Scheduled!", description: "The match has been successfully created." });
      setLocation("/matches");
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: (err as Error).message });
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <Layout title="New Match" showBack>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Home Team</Label>
              <Select value={homeTeamId} onValueChange={setHomeTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {teams?.map((team: any) => (
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
                  {teams?.map((team: any) => (
                    <SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
              placeholder="e.g. City Stadium" 
              value={locationName} 
              onChange={e => setLocationName(e.target.value)} 
            />
          </div>

        </div>

        <Button type="submit" size="lg" className="w-full font-bold text-lg h-12 shadow-lg shadow-primary/20" disabled={createMatch.isPending}>
          {createMatch.isPending ? "Scheduling..." : "Create Match"}
        </Button>
      </form>
    </Layout>
  );
}
