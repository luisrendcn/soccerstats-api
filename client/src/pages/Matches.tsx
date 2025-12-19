import { useState } from "react";
import { useMatches, useCreateMatch } from "@/hooks/use-matches";
import { useTeams } from "@/hooks/use-teams";
import { Layout } from "@/components/Layout";
import { MatchCard } from "@/components/MatchCard";
import { Loader2, Plus } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Matches() {
  const { data: matches, isLoading: matchesLoading } = useMatches();
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'finished'>('all');

  const isLoading = matchesLoading || teamsLoading;

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  // Enrich matches with team data
  const enrichedMatches = matches?.map(m => ({
    ...m,
    homeTeam: teams?.find(t => t.id === m.homeTeamId),
    awayTeam: teams?.find(t => t.id === m.awayTeamId),
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredMatches = enrichedMatches?.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  return (
    <Layout title="Match Schedule">
      {/* Filter Tabs */}
      <div className="flex p-1 bg-muted/50 rounded-xl mb-6">
        {['all', 'scheduled', 'finished'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              filter === f ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4 mb-20">
        {filteredMatches?.map(match => (
          <MatchCard key={match.id} match={match} />
        ))}

        {filteredMatches?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No {filter !== 'all' ? filter : ''} matches found.</p>
            <Link href="/matches/new">
              <Button>Schedule a Match</Button>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
