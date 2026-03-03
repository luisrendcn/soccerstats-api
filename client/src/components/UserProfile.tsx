import { useAuth, useLogout } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Settings, Users, Shield } from "lucide-react";
import { Loader2 } from "lucide-react";

export function UserProfile() {
  const { data: auth, isLoading } = useAuth();
  const logout = useLogout();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin" />;
  }

  if (!auth) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation("/login")}
      >
        Iniciar Sesión
      </Button>
    );
  }

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      setLocation("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <User className="w-4 h-4" />
          <span className="text-sm">{auth.userRole}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5 text-sm font-medium text-foreground">
          Mi Perfil
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          Rol: <span className="capitalize font-semibold">{auth.userRole}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {auth.userRole === "admin" && (
          <>
            <DropdownMenuItem onClick={() => setLocation("/admin/users")}>
              <Users className="w-4 h-4 mr-2" />
              Gestión de Usuarios
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => setLocation("/settings")}>
          <Settings className="w-4 h-4 mr-2" />
          Configuración
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
