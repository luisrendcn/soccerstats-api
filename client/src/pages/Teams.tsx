import { useState } from "react";
import { useTeams, useCreateTeam } from "@/hooks/use-teams";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { TeamColorGradientBackground, TeamColorCircle } from "@/components/TeamColor";
import { Link } from "wouter";
import { Loader2, Plus, Users, Trash } from "lucide-react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n.tsx";

export default function Teams() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { data: teamsResp, isLoading } = useTeams(page, 10, search);
  const teams = teamsResp;
  const totalPages = 1; // Single page for now
  const { t } = useLanguage();
  const { toast } = useToast();
  const createTeam = useCreateTeam();
  const { data: auth } = useAuth();
  const isPublic = auth?.userRole === "public";
  const canCreateTeam = auth?.userRole === "admin" || auth?.userRole === "tournament_manager";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#000000");

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName) return;

    try {
      await createTeam.mutateAsync({ name: newTeamName, color: newTeamColor });
      toast({ title: t('teamCreated'), description: `${newTeamName} ${t('hasBeenAdded')}` });
      setNewTeamName("");
      setNewTeamColor("#000000");
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
    } catch (err) {
      toast({ variant: "destructive", title: t('error'), description: (err as Error).message });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <Layout title={t('teamsTitle')}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-24">
        {/* Create Team Card (only admin/tournament_manager) */}
        {canCreateTeam && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex flex-col items-center justify-center p-6 bg-card border-2 border-dashed border-border rounded-xl hover:border-primary/50 hover:bg-muted/20 transition-all group min-h-[160px]">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-colors">
                  <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                </div>
                <span className="font-display font-bold text-muted-foreground group-hover:text-primary">{t('createNewTeam')}</span>
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('registerNewTeam')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTeam} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('teamName')}</Label>
                  <Input 
                    id="name" 
                    value={newTeamName} 
                    onChange={(e) => setNewTeamName(e.target.value)} 
                    placeholder="e.g. Mighty Ducks"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">{t('teamColor')}</Label>
                  <div className="flex gap-2 items-center">
                    <Input 
                      id="color" 
                      type="color" 
                      value={newTeamColor} 
                      onChange={(e) => setNewTeamColor(e.target.value)} 
                      className="w-12 h-12 p-1 cursor-pointer"
                    />
                    <span className="text-sm font-mono text-muted-foreground">{newTeamColor}</span>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createTeam.isPending}>
                  {createTeam.isPending ? t('creating') : t('createTeam')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Team Cards */}
        <div className="flex items-center gap-2 mb-4">
          <Input placeholder="Search teams..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
        </div>
        {teams?.map((team: any) => (
          <div key={team.id} className="relative">
            <Link href={`/teams/${team.id}`}>
              <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group relative overflow-hidden h-full flex flex-col justify-between min-h-[160px]">
                <TeamColorGradientBackground color={team.color} />
                
                <div>
                  <TeamColorCircle color={team.color} />
                  <h3 className="font-display font-bold text-xl leading-tight mb-1">{team.name}</h3>
                  <p className="text-sm text-muted-foreground">{t('tapToViewRoster')}</p>
                </div>
                
                <div className="flex justify-end mt-4">
                   <Users className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary/50" />
                </div>
              </div>
            </Link>
            {auth?.userRole === 'admin' && (
              <button title={`Delete ${team.name}`} className="absolute top-2 right-2 p-2 rounded-md bg-red-50 hover:bg-red-100" onClick={async (e) => { e.preventDefault(); if (!confirm(`Delete ${team.name}?`)) return; await fetch(`/api/teams/${team.id}`, { method: 'DELETE', credentials: 'include' }); queryClient.invalidateQueries({ queryKey: ['/api/teams'] }); }}>
                <Trash className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        ))}

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <Button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
          <div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
          <Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    </Layout>
  );
}
