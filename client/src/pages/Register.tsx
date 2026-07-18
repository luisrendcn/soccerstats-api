import { useState } from "react";
import { useLocation } from "wouter";
import { useRegister } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus } from "lucide-react";
import { useLanguage } from "@/lib/i18n.tsx";
import { useTournaments } from "@/hooks/use-tournaments";

const REQUESTABLE_ROLES = ["tournament_manager", "team_captain", "referee"] as const;

type RequestableRole = (typeof REQUESTABLE_ROLES)[number];
type RequestKind = "account" | "team";
type TeamType = "soccer" | "videogame";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const register = useRegister();
  const { data: tournaments = [] } = useTournaments();
  const [requestSent, setRequestSent] = useState(false);
  
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [twitchChannel, setTwitchChannel] = useState("");
  const [playersText, setPlayersText] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestKind, setRequestKind] = useState<RequestKind>("team");
  const [teamType, setTeamType] = useState<TeamType>("soccer");
  const [tournamentId, setTournamentId] = useState("");
  const [requestedRole, setRequestedRole] = useState<RequestableRole>("team_captain");
  const matchingTournaments = tournaments.filter(
    (tournament) => tournament.tournamentType === teamType,
  );
  const isTeamRequest = requestKind === "team";
  const isVideogameTeam = isTeamRequest && teamType === "videogame";
  const requiresAccount = !isTeamRequest || teamType === "soccer";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const displayName = isTeamRequest ? teamName.trim() : name.trim();
    if (!displayName) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: isTeamRequest ? t("teamNameRequired") : t("nameRequired")
      });
      return;
    }

    if (isTeamRequest && !tournamentId) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("tournamentRequired")
      });
      return;
    }

    if (isVideogameTeam && !twitchChannel.trim()) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("twitchChannelRequiredDescription")
      });
      return;
    }

    if (requiresAccount && password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("passwordsDoNotMatch")
      });
      return;
    }

    if (requiresAccount && password.length < 6) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("passwordMinLength")
      });
      return;
    }

    try {
      const players = playersText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [namePart, numberPart] = line.split(",").map((part) => part.trim());
          const number = numberPart ? Number(numberPart) : null;
          return {
            name: namePart,
            number: Number.isFinite(number) ? number : null,
          };
        });

      await register.mutateAsync({
        requestKind,
        requestedRole: isTeamRequest ? "team_captain" : requestedRole,
        teamType: isTeamRequest ? teamType : undefined,
        tournamentId: isTeamRequest ? Number(tournamentId) : undefined,
        teamName: isTeamRequest ? teamName.trim() : undefined,
        twitchChannel: isVideogameTeam ? twitchChannel.trim() : undefined,
        players: isTeamRequest && teamType === "soccer" ? players : undefined,
        email: requiresAccount ? email : undefined,
        name: isTeamRequest ? teamName.trim() : name.trim(),
        password: requiresAccount ? password : undefined,
        confirmPassword: requiresAccount ? confirmPassword : undefined,
      });
      toast({ title: t("requestSent"), description: t("requestPendingDescription") });
      setRequestSent(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError")
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <div className="p-8">
          <div className="flex items-center justify-center gap-2 mb-8">
            <UserPlus className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">{t("requestRoleTitle")}</h1>
          </div>

          <div className="mb-6 rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm text-muted-foreground">
            {t("appWorksPublicly")}
          </div>

          {requestSent ? (
            <div className="space-y-5 text-center">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <h2 className="font-semibold">{t("requestPendingTitle")}</h2>
                <p className="mt-2 text-sm">
                  {t("requestPendingDescription")}
                </p>
              </div>
              <Button className="w-full" onClick={() => setLocation("/")}>
                {t("backToPublicApp")}
              </Button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requestKind">{t("requestType")}</Label>
              <Select
                value={requestKind}
                onValueChange={(value) => setRequestKind(value as RequestKind)}
              >
                <SelectTrigger id="requestKind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">{t("teamEnrollment")}</SelectItem>
                  <SelectItem value="account">{t("staffAccess")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isTeamRequest ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="teamType">{t("teamType")}</Label>
                  <Select
                    value={teamType}
                    onValueChange={(value) => {
                      setTeamType(value as TeamType);
                      setTournamentId("");
                    }}
                  >
                    <SelectTrigger id="teamType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soccer">{t("normalTeam")}</SelectItem>
                      <SelectItem value="videogame">{t("videogameTeam")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tournamentId">{t("tournamentToJoin")}</Label>
                  <Select value={tournamentId} onValueChange={setTournamentId}>
                    <SelectTrigger id="tournamentId">
                      <SelectValue placeholder={t("selectTournament")} />
                    </SelectTrigger>
                    <SelectContent>
                      {matchingTournaments.map((tournament) => (
                        <SelectItem key={tournament.id} value={String(tournament.id)}>
                          {tournament.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {matchingTournaments.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("noTournamentsForType")}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teamName">{t("teamNameLower")}</Label>
                  <Input
                    id="teamName"
                    type="text"
                    placeholder={t("teamNameLower") as string}
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                  />
                </div>

                {isVideogameTeam ? (
                  <div className="space-y-2">
                    <Label htmlFor="twitchChannel">{t("twitchChannel")}</Label>
                    <Input
                      id="twitchChannel"
                      type="text"
                      placeholder={t("twitchParticipantPlaceholder") as string}
                      value={twitchChannel}
                      onChange={(e) => setTwitchChannel(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("videogameRegistrationNoLogin")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="playersText">{t("playersToEnroll")}</Label>
                    <textarea
                      id="playersText"
                      className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder={t("playersToEnrollPlaceholder") as string}
                      value={playersText}
                      onChange={(e) => setPlayersText(e.target.value)}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">{t("fullName")}</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Juan Perez"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requestedRole">{t("roleToRequest")}</Label>
                  <Select
                    value={requestedRole}
                    onValueChange={(value) =>
                      setRequestedRole(value as RequestableRole)
                    }
                  >
                    <SelectTrigger id="requestedRole">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUESTABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {{
                            tournament_manager: t("roleTournamentManager"),
                            team_captain: t("roleTeamCaptain"),
                            referee: t("roleReferee"),
                          }[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {requiresAccount && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  <PasswordInput
                    id="password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    showLabel={t("showPassword")}
                    hideLabel={t("hidePassword")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="********"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    showLabel={t("showPassword")}
                    hideLabel={t("hidePassword")}
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={register.isPending}
            >
              {register.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("sendingRequest")}
                </>
              ) : (
                t("sendRequest")
              )}
            </Button>
          </form>
          )}

          {!requestSent && <div className="mt-6 text-center text-sm text-muted-foreground">
            {t("alreadyApprovedAccount")}{" "}
            <button
              onClick={() => setLocation("/login")}
              className="text-primary hover:underline font-semibold"
            >
              {t("login")}
            </button>
          </div>}
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => setLocation("/")}
          >
            {t("continueAsPublic")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
