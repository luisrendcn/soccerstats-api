import { useState } from "react";
import { Layout } from "@/components/Layout";
import {
  useApproveRegistrationRequest,
  useCreateUser,
  useDeleteUserPermanently,
  useRegistrationRequests,
  useRejectRegistrationRequest,
  useSetUserActive,
  useUpdateUserRole,
  useUsers,
} from "@/hooks/use-admin";
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
import {
  Check,
  Clock,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  Shield,
  Trash2,
  X,
} from "lucide-react";

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
  const { data: registrationRequests, isLoading: requestsLoading } =
    useRegistrationRequests();
  const createUser = useCreateUser();
  const updateRole = useUpdateUserRole();
  const setUserActive = useSetUserActive();
  const deleteUserPermanently = useDeleteUserPermanently();
  const approveRequest = useApproveRegistrationRequest();
  const rejectRequest = useRejectRegistrationRequest();

  // Form state
  const [openCreate, setOpenCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("public");

  const [statusChange, setStatusChange] = useState<{
    id: number;
    isActive: boolean;
    name: string;
  } | null>(null);
  const [reviewRequest, setReviewRequest] = useState<{
    id: number;
    name: string;
    action: "approve" | "reject";
  } | null>(null);
  const [deleteUser, setDeleteUser] = useState<{
    id: number;
    name: string;
    email: string;
  } | null>(null);

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

  const handleStatusChange = async () => {
    if (!statusChange) return;

    try {
      await setUserActive.mutateAsync({
        id: statusChange.id,
        isActive: statusChange.isActive,
      });
      toast({
        title: "Éxito",
        description: statusChange.isActive
          ? "Usuario desbloqueado exitosamente"
          : "Usuario bloqueado exitosamente",
      });
      setStatusChange(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    }
  };

  const handleReviewRequest = async () => {
    if (!reviewRequest) return;

    try {
      if (reviewRequest.action === "approve") {
        await approveRequest.mutateAsync(reviewRequest.id);
      } else {
        await rejectRequest.mutateAsync(reviewRequest.id);
      }
      toast({
        title: "Solicitud procesada",
        description:
          reviewRequest.action === "approve"
            ? "El usuario ya puede ingresar a la app"
            : "La solicitud fue rechazada",
      });
      setReviewRequest(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteUser) return;

    try {
      await deleteUserPermanently.mutateAsync(deleteUser.id);
      toast({
        title: "Usuario eliminado",
        description: `${deleteUser.name} fue eliminado de la base de datos`,
      });
      setDeleteUser(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    }
  };

  if (isLoading || requestsLoading) {
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
  const activeUsers = users?.filter((user) => user.isActive) || [];
  const blockedUsers = users?.filter((user) => !user.isActive) || [];

  return (
    <Layout title="Gestión de Usuarios">
      <div className="space-y-6">
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-700" />
              <h2 className="font-semibold text-amber-900">Lista de espera</h2>
            </div>
            <span className="rounded-full bg-amber-600 px-2 py-1 text-xs font-bold text-white">
              {registrationRequests?.length || 0}
            </span>
          </div>

          <div className="space-y-3">
            {registrationRequests?.map((request) => (
              <div
                key={request.id}
                className="rounded-lg border border-amber-200 bg-background p-3"
              >
                <p className="font-medium">{request.name}</p>
                <p className="text-xs text-muted-foreground">{request.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Solicitó acceso:{" "}
                  {request.requestedAt
                    ? new Date(request.requestedAt).toLocaleString()
                    : "Fecha no disponible"}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1 bg-green-600 hover:bg-green-700"
                    onClick={() =>
                      setReviewRequest({
                        id: request.id,
                        name: request.name,
                        action: "approve",
                      })
                    }
                  >
                    <Check className="h-4 w-4" />
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 gap-1"
                    onClick={() =>
                      setReviewRequest({
                        id: request.id,
                        name: request.name,
                        action: "reject",
                      })
                    }
                  >
                    <X className="h-4 w-4" />
                    Rechazar
                  </Button>
                </div>
              </div>
            ))}

            {!registrationRequests?.length && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay solicitudes pendientes
              </p>
            )}
          </div>
        </section>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Usuarios activos ({activeUsers.length})
          </h2>
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
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {activeUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => handleChangeRole(user.id, newRole)}
                        disabled={!user.isActive}
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
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          user.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {user.isActive ? "Activo" : "Bloqueado"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          setStatusChange({
                            id: user.id,
                            isActive: !user.isActive,
                            name: user.name,
                          })
                        }
                        className={`p-1 transition-colors ${
                          user.isActive
                            ? "text-red-600 hover:text-red-700"
                            : "text-green-600 hover:text-green-700"
                        }`}
                        title={user.isActive ? "Bloquear usuario" : "Desbloquear usuario"}
                      >
                        {user.isActive ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <LockOpen className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setDeleteUser({
                            id: user.id,
                            name: user.name,
                            email: user.email,
                          })
                        }
                        className="ml-2 p-1 text-red-700 transition-colors hover:text-red-900"
                        title="Eliminar usuario de la base de datos"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!activeUsers.length && (
            <div className="text-center py-8 text-muted-foreground">
              No hay usuarios activos
            </div>
          )}
        </div>

        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Usuarios bloqueados ({blockedUsers.length})
          </h2>
          <div className="space-y-2">
            {blockedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <div className="ml-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-green-700"
                    onClick={() =>
                      setStatusChange({
                        id: user.id,
                        isActive: true,
                        name: user.name,
                      })
                    }
                  >
                    <LockOpen className="h-4 w-4" />
                    Desbloquear
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                    onClick={() =>
                      setDeleteUser({
                        id: user.id,
                        name: user.name,
                        email: user.email,
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
            {!blockedUsers.length && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay usuarios bloqueados
              </p>
            )}
          </div>
        </section>

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

        <AlertDialog
          open={reviewRequest !== null}
          onOpenChange={(open) => {
            if (!open) setReviewRequest(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {reviewRequest?.action === "approve"
                  ? "Aprobar solicitud"
                  : "Rechazar solicitud"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {reviewRequest?.action === "approve"
                  ? `¿Deseas crear la cuenta de ${reviewRequest.name} y permitirle ingresar?`
                  : `¿Deseas rechazar la solicitud de ${reviewRequest?.name}? Este correo no podrá enviar otra solicitud.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-3">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReviewRequest}
                disabled={approveRequest.isPending || rejectRequest.isPending}
                className={
                  reviewRequest?.action === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }
              >
                {approveRequest.isPending || rejectRequest.isPending
                  ? "Procesando..."
                  : reviewRequest?.action === "approve"
                    ? "Aprobar"
                    : "Rechazar"}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        {/* Status Change Confirmation */}
        <AlertDialog open={statusChange !== null} onOpenChange={(open) => {
          if (!open) setStatusChange(null);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {statusChange?.isActive ? "Desbloquear Usuario" : "Bloquear Usuario"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {statusChange?.isActive
                  ? `¿Deseas permitir que ${statusChange.name} vuelva a ingresar a la app?`
                  : `¿Deseas bloquear a ${statusChange?.name}? Su sesión se cerrará y no podrá ingresar hasta que un administrador lo desbloquee.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleStatusChange}
                disabled={setUserActive.isPending}
                className={
                  statusChange?.isActive
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }
              >
                {setUserActive.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  statusChange?.isActive ? "Desbloquear" : "Bloquear"
                )}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={deleteUser !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteUser(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar de la base de datos</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Seguro que deseas eliminar definitivamente a {deleteUser?.name} (
                {deleteUser?.email})? Esta acción borra su cuenta de la base de
                datos y no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handlePermanentDelete}
                disabled={deleteUserPermanently.isPending}
                className="bg-red-700 hover:bg-red-800"
              >
                {deleteUserPermanently.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  "Eliminar definitivamente"
                )}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
