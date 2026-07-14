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

const REQUESTABLE_ROLES = ["tournament_manager", "team_captain", "referee"] as const;

type RequestableRole = (typeof REQUESTABLE_ROLES)[number];

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const register = useRegister();
  const [requestSent, setRequestSent] = useState(false);
  
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<RequestableRole>("team_captain");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("nameRequired")
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("passwordsDoNotMatch")
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("passwordMinLength")
      });
      return;
    }

    try {
      await register.mutateAsync({
        email,
        name,
        password,
        confirmPassword,
        requestedRole,
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
              <Label htmlFor="name">{t("fullName")}</Label>
              <Input
                id="name"
                type="text"
                placeholder="Juan Pérez"
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
                placeholder="••••••••"
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
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                showLabel={t("showPassword")}
                hideLabel={t("hidePassword")}
              />
            </div>

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
