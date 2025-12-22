import { useState } from "react";
import { useTeams, useCreateTeam } from "@/hooks/use-teams";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Loader2, Plus, Users } from "lucide-react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n.tsx";

export default function Teams() {
  const { t } = useLanguage();
  const { data: teams, isLoading } = useTeams();
  const { toast } = useToast();
  const createTeam = useCreateTeam();
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
        {/* Create Team Card */}
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

        {/* Team Cards */}
        {teams?.map((team) => (
          <Link key={team.id} href={`/teams/${team.id}`}>
            <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group relative overflow-hidden h-full flex flex-col justify-between min-h-[160px]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-transparent to-black/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" style={{ backgroundColor: `${team.color}10` }} />
              
              <div>
                <div className="w-10 h-10 rounded-full mb-4 shadow-sm" style={{ backgroundColor: team.color }} />
                <h3 className="font-display font-bold text-xl leading-tight mb-1">{team.name}</h3>
                <p className="text-sm text-muted-foreground">{t('tapToViewRoster')}</p>
              </div>
              
              <div className="flex justify-end mt-4">
                 <Users className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary/50" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
