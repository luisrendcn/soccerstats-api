import { useAuth, useLogout } from "@/hooks/use-auth";
import { useRegistrationRequests } from "@/hooks/use-admin";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Settings, Users } from "lucide-react";
import { Loader2 } from "lucide-react";

export function UserProfile() {
  const { data: auth, isLoading } = useAuth();
  const logout = useLogout();
  const [, setLocation] = useLocation();
  const isAdmin = auth?.userRole === "admin";
  const { data: registrationRequests } = useRegistrationRequests(isAdmin);
  const pendingCount = registrationRequests?.length || 0;

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
        <Button variant="ghost" size="sm" className="relative gap-2">
          <User className="w-4 h-4" />
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <span className="max-w-24 truncate text-sm font-semibold">
              {auth.name}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {auth.userRole}
            </span>
          </span>
          {pendingCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-[10px] font-bold leading-5 text-white">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium text-foreground">{auth.name}</p>
          <p className="text-xs text-muted-foreground">{auth.email}</p>
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
              {pendingCount > 0 && (
                <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                  {pendingCount}
                </span>
              )}
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
