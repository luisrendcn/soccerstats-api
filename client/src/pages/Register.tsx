import { useState } from "react";
import { useLocation } from "wouter";
import { useRegister } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const register = useRegister();
  
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
      await register.mutateAsync({ email, name, password, confirmPassword });
      toast({ title: "✓ Cuenta creada", description: "Serás redirigido automáticamente..." });
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
            <UserPlus className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Crear Cuenta</h1>
          </div>

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
                "Registrarse"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <button
              onClick={() => setLocation("/login")}
              className="text-primary hover:underline font-semibold"
            >
              Inicia sesión
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
