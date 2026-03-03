import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

interface ProtectedRouteProps {
  component: React.ComponentType;
  requiredRole?: string;
}

export function ProtectedRoute({ component: Component, requiredRole }: ProtectedRouteProps) {
  const { data: auth, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !auth) {
      // Redirigir al login si no está autenticado
      setLocation("/login");
    } else if (!isLoading && auth && requiredRole && auth.userRole !== requiredRole) {
      // Redirigir a home si no tiene el rol requerido
      setLocation("/");
    }
  }, [auth, isLoading, requiredRole, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!auth) {
    return null; // Se va a redirigir
  }

  if (requiredRole && auth.userRole !== requiredRole) {
    return null; // Se va a redirigir
  }

  return <Component />;
}
