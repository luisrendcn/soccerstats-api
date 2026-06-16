import { useState } from "react";
import { useLocation } from "wouter";
import { useRegister } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus } from "lucide-react";

const REQUESTABLE_ROLES = [
  { value: "tournament_manager", label: "Gestor de torneos" },
  { value: "team_captain", label: "Capitán / líder de equipo" },
  { value: "referee", label: "Árbitro" },
] as const;

type RequestableRole = (typeof REQUESTABLE_ROLES)[number]["value"];

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
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
        title: "Error",
        description: "El nombre es requerido"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Las contraseñas no coinciden"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres"
      });
      return;
    }

    try {
      const response = await register.mutateAsync({
        email,
        name,
        password,
        confirmPassword,
        requestedRole,
      });
      toast({ title: "Solicitud enviada", description: response.message });
      setRequestSent(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <div className="p-8">
          <div className="flex items-center justify-center gap-2 mb-8">
            <UserPlus className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Solicitar un rol</h1>
          </div>

          <div className="mb-6 rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm text-muted-foreground">
            La app funciona como público sin cuenta. Si necesitas cumplir un
            rol dentro de la plataforma, solicita acceso aquí o comunícate con
            el administrador al <span className="font-semibold text-foreground">3507803134</span>.
          </div>

          {requestSent ? (
            <div className="space-y-5 text-center">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <h2 className="font-semibold">Solicitud en espera</h2>
                <p className="mt-2 text-sm">
                  Un administrador debe aprobar tu cuenta antes de que puedas
                  iniciar sesión con el rol solicitado.
                </p>
              </div>
              <Button className="w-full" onClick={() => setLocation("/")}>
                Volver a la app pública
              </Button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo</Label>
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
              <Label htmlFor="requestedRole">Rol que deseas cumplir</Label>
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
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
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
                  Creando cuenta...
                </>
              ) : (
                "Enviar solicitud"
              )}
            </Button>
          </form>
          )}

          {!requestSent && <div className="mt-6 text-center text-sm text-muted-foreground">
            ¿Ya tienes una cuenta aprobada?{" "}
            <button
              onClick={() => setLocation("/login")}
              className="text-primary hover:underline font-semibold"
            >
              Inicia sesión
            </button>
          </div>}
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => setLocation("/")}
          >
            Continuar como público
          </Button>
        </div>
      </Card>
    </div>
  );
}
