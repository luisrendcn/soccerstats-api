import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLogin();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login.mutateAsync({ email, password });
      toast({ title: "✓ Bienvenido", description: "Iniciaste sesión exitosamente." });
      // Dar un pequeño delay para que se muestre el toast antes de navegar
      setTimeout(() => setLocation("/"), 800);
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
            <Lock className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Soccer Stats</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <Button
              type="submit"
              className="w-full"
              disabled={login.isPending}
            >
              {login.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <button
              onClick={() => setLocation("/register")}
              className="text-primary hover:underline font-semibold"
            >
              Regístrate aquí
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
