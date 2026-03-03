import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useUsers, useCreateUser, useUpdateUserRole, useDeleteUser } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Shield } from "lucide-react";

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "tournament_manager", label: "Gestor de Torneos" },
  { value: "team", label: "Equipo" },
  { value: "referee", label: "Árbitro" },
  { value: "public", label: "Público" },
];

export default function AdminUsers() {
  const { toast } = useToast();
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();

  // Form state
  const [openCreate, setOpenCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("public");

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Role change
  const [roleChangeId, setRoleChangeId] = useState<number | null>(null);
  const [roleChangeValue, setRoleChangeValue] = useState("");

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !name || !password) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Todos los campos son requeridos",
      });
      return;
    }

    try {
      await createUser.mutateAsync({
        email,
        name,
        password,
        role,
      });
      toast({
        title: "Éxito",
        description: "Usuario creado exitosamente",
      });
      setEmail("");
      setName("");
      setPassword("");
      setRole("public");
      setOpenCreate(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    }
  };

  const handleChangeRole = (userId: number, newRole: string) => {
    setRoleChangeId(userId);
    setRoleChangeValue(newRole);
  };

  const confirmRoleChange = async () => {
    if (!roleChangeId) return;

    try {
      await updateRole.mutateAsync({
        id: roleChangeId,
        role: roleChangeValue,
      });
      toast({
        title: "Éxito",
        description: "Rol actualizado exitosamente",
      });
      setRoleChangeId(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await deleteUser.mutateAsync(userId);
      toast({
        title: "Éxito",
        description: "Usuario eliminado exitosamente",
      });
      setDeleteConfirm(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    }
  };

  if (isLoading) {
    return (
      <Layout title="Gestión de Usuarios">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const roleLabel = (roleValue: string) => {
    return ROLES.find((r) => r.value === roleValue)?.label || roleValue;
  };

  return (
    <Layout title="Gestión de Usuarios">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Todos los Usuarios</h2>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription>
                  Completa el formulario para crear un nuevo usuario
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input
                    id="name"
                    placeholder="Juan Pérez"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@inder.gov.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createUser.isPending}
                >
                  {createUser.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Usuario"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Users Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Rol</th>
                  <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {users?.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => handleChangeRole(user.id, newRole)}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setDeleteConfirm(user.id)}
                        className="text-red-600 hover:text-red-700 transition-colors p-1"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!users?.length && (
            <div className="text-center py-8 text-muted-foreground">
              No hay usuarios registrados
            </div>
          )}
        </div>

        {/* Role Change Confirmation */}
        <AlertDialog open={roleChangeId !== null} onOpenChange={(open) => {
          if (!open) setRoleChangeId(null);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Cambiar Rol
              </AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas cambiar el rol a{" "}
                <span className="font-semibold">{roleLabel(roleChangeValue)}</span>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRoleChange}
                disabled={updateRole.isPending}
              >
                {updateRole.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar Usuario</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas eliminar este usuario? Esta acción no se
                puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConfirm) handleDeleteUser(deleteConfirm);
                }}
                disabled={deleteUser.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteUser.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  "Eliminar"
                )}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
