import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

interface ProtectedRouteProps {
  component: React.ComponentType;
  requiredRole?: string | string[];
  allowPublic?: boolean;
}

export function ProtectedRoute({
  component: Component,
  requiredRole,
  allowPublic = false,
}: ProtectedRouteProps) {
  const { data: auth, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const requiredRoles = Array.isArray(requiredRole)
    ? requiredRole
    : requiredRole
      ? [requiredRole]
      : [];
  const hasRequiredRole =
    requiredRoles.length === 0 || (auth && requiredRoles.includes(auth.userRole));

  useEffect(() => {
    if (!isLoading && !auth && !allowPublic) {
      // Redirigir al login si no está autenticado
      setLocation("/login");
    } else if (!isLoading && auth && !hasRequiredRole) {
      // Redirigir a home si no tiene el rol requerido
      setLocation("/");
    }
  }, [allowPublic, auth, hasRequiredRole, isLoading, setLocation]);

  if (isLoading && !allowPublic) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!auth && !allowPublic) {
    return null; // Se va a redirigir
  }

  if (auth && !hasRequiredRole) {
    return null; // Se va a redirigir
  }

  return <Component />;
}
