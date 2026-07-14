import { useState } from "react";
import { Layout } from "@/components/Layout";
import {
  useApproveRegistrationRequest,
  useCreateUser,
  useDeleteUserPermanently,
  useRegistrationRequests,
  useRejectRegistrationRequest,
  useSetUserActive,
  useUpdateUser,
  useUpdateUserRole,
  useUsers,
} from "@/hooks/use-admin";
import { useTeams } from "@/hooks/use-teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
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
import { useLanguage } from "@/lib/i18n.tsx";

const ROLES = ["admin", "tournament_manager", "team_captain", "referee", "public"] as const;

const isTeamCaptainRole = (roleValue: string) =>
  roleValue === "team_captain" || roleValue === "team";

export default function AdminUsers() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: users, isLoading } = useUsers();
  const { data: teams } = useTeams(1, 1000);
  const { data: registrationRequests, isLoading: requestsLoading } =
    useRegistrationRequests();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
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
  const [teamId, setTeamId] = useState("none");

  const [statusChange, setStatusChange] = useState<{
    id: number;
    isActive: boolean;
    name: string;
  } | null>(null);
  const [reviewRequest, setReviewRequest] = useState<{
    id: number;
    name: string;
    requestedRole: string;
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
        title: t("error"),
        description: t("allFieldsRequired"),
      });
      return;
    }

    try {
      await createUser.mutateAsync({
        email,
        name,
        password,
        role,
        teamId:
          isTeamCaptainRole(role) && teamId !== "none" ? Number(teamId) : null,
      });
      toast({
        title: t("success"),
        description: t("userCreated"),
      });
      setEmail("");
      setName("");
      setPassword("");
      setRole("public");
      setTeamId("none");
      setOpenCreate(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
      });
    }
  };

  const handleChangeRole = (userId: number, newRole: string) => {
    setRoleChangeId(userId);
    setRoleChangeValue(newRole);
  };

  const handleAssignTeam = async (userId: number, newTeamId: string) => {
    try {
      await updateUser.mutateAsync({
        id: userId,
        teamId: newTeamId === "none" ? null : Number(newTeamId),
      });
      toast({
        title: t("teamAssigned"),
        description:
          newTeamId === "none"
            ? t("userWithoutAssignedTeam")
            : t("captainCanManageTeam"),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
      });
    }
  };

  const confirmRoleChange = async () => {
    if (!roleChangeId) return;

    try {
      await updateRole.mutateAsync({
        id: roleChangeId,
        role: roleChangeValue,
      });
      toast({
        title: t("success"),
        description: t("roleUpdated"),
      });
      setRoleChangeId(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
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
        title: t("success"),
        description: statusChange.isActive
          ? t("userUnlocked")
          : t("userBlocked"),
      });
      setStatusChange(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
      });
    }
  };

  const handleReviewRequest = async () => {
    if (!reviewRequest) return;

    try {
      const result =
        reviewRequest.action === "approve"
          ? await approveRequest.mutateAsync(reviewRequest.id)
          : await rejectRequest.mutateAsync(reviewRequest.id);

      const emailDelivery =
        reviewRequest.action === "approve" && "emailDelivery" in result
          ? result.emailDelivery
          : undefined;

      if (reviewRequest.action === "approve") {
        toast({
          variant:
            emailDelivery?.status === "failed" ? "destructive" : "default",
          title: t("requestProcessed"),
          description:
            emailDelivery?.status === "failed"
              ? emailDelivery.message || t("approvalEmailNotSent")
              : t("userCanEnterApp"),
        });
      } else {
        toast({
          title: t("requestProcessed"),
          description: t("requestRejected"),
        });
      }
      setReviewRequest(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
      });
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteUser) return;

    try {
      await deleteUserPermanently.mutateAsync(deleteUser.id);
      toast({
        title: t("userDeleted"),
        description: t("userDeletedDescription", { name: deleteUser.name }),
      });
      setDeleteUser(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("error"),
        description: t("unexpectedError"),
      });
    }
  };

  if (isLoading || requestsLoading) {
    return (
      <Layout title={t("userManagement")}>
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const roleLabel = (roleValue: string) => {
    if (roleValue === "admin") return t("roleAdmin");
    if (roleValue === "tournament_manager") return t("roleTournamentManager");
    if (roleValue === "team_captain" || roleValue === "team") return t("roleTeamCaptainLong");
    if (roleValue === "referee") return t("roleReferee");
    if (roleValue === "public") return t("publicUser");
    return roleValue;
  };
  const activeUsers = users?.filter((user) => user.isActive) || [];
  const blockedUsers = users?.filter((user) => !user.isActive) || [];
  const canLockOrDeleteUser = (roleValue: string) => roleValue !== "admin";

  return (
    <Layout title={t("userManagement")}>
      <div className="space-y-6">
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-700" />
              <h2 className="font-semibold text-amber-900">{t("waitingList")}</h2>
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
                  {t("requestedRole")}:{" "}
                  <span className="font-semibold">
                    {roleLabel(request.requestedRole || "team_captain")}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("requestedAccess")}:{" "}
                  {request.requestedAt
                    ? new Date(request.requestedAt).toLocaleString()
                    : t("dateUnavailable")}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1 bg-green-600 hover:bg-green-700"
                    onClick={() =>
                      setReviewRequest({
                        id: request.id,
                        name: request.name,
                        requestedRole: request.requestedRole || "team_captain",
                        action: "approve",
                      })
                    }
                  >
                    <Check className="h-4 w-4" />
                    {t("approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 gap-1"
                    onClick={() =>
                      setReviewRequest({
                        id: request.id,
                        name: request.name,
                        requestedRole: request.requestedRole || "team_captain",
                        action: "reject",
                      })
                    }
                  >
                    <X className="h-4 w-4" />
                    {t("reject")}
                  </Button>
                </div>
              </div>
            ))}

            {!registrationRequests?.length && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("noPendingRequests")}
              </p>
            )}
          </div>
        </section>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("activeUsers", { count: activeUsers.length })}
          </h2>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                {t("newUser")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("createNewUser")}</DialogTitle>
                <DialogDescription>
                  {t("createUserDescription")}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("fullName")}</Label>
                  <Input
                    id="name"
                    placeholder="Juan Pérez"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@inder.gov.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    showLabel={t("showPassword")}
                    hideLabel={t("hidePassword")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">{t("role")}</Label>
                  <Select
                    value={role}
                    onValueChange={(value) => {
                      setRole(value);
                      if (!isTeamCaptainRole(value)) setTeamId("none");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((roleValue) => (
                        <SelectItem key={roleValue} value={roleValue}>
                          {roleLabel(roleValue)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isTeamCaptainRole(role) && (
                  <div className="space-y-2">
                    <Label htmlFor="teamId">{t("assignedTeam")}</Label>
                    <Select value={teamId} onValueChange={setTeamId}>
                      <SelectTrigger id="teamId">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("noTeamYet")}</SelectItem>
                        {teams?.map((team) => (
                          <SelectItem key={team.id} value={String(team.id)}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createUser.isPending}
                >
                  {createUser.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t("creating")}
                    </>
                  ) : (
                    t("createNewUser")
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
                  <th className="px-4 py-3 text-left font-semibold">{t("name")}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t("email")}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t("role")}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t("status")}</th>
                  <th className="px-4 py-3 text-center font-semibold">{t("actions")}</th>
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
                        value={
                          user.role === "team" ? "team_captain" : user.role
                        }
                        onValueChange={(newRole) => handleChangeRole(user.id, newRole)}
                        disabled={!user.isActive}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((roleValue) => (
                            <SelectItem key={roleValue} value={roleValue}>
                              {roleLabel(roleValue)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isTeamCaptainRole(user.role) && (
                        <div className="mt-2">
                          <Select
                            value={
                              user.teamId ? String(user.teamId) : "none"
                            }
                            onValueChange={(newTeamId) =>
                              handleAssignTeam(user.id, newTeamId)
                            }
                            disabled={!user.isActive || updateUser.isPending}
                          >
                            <SelectTrigger className="h-8 w-44">
                              <SelectValue placeholder={t("assignedTeam")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                {t("noAssignedTeam")}
                              </SelectItem>
                              {teams?.map((team) => (
                                <SelectItem
                                  key={team.id}
                                  value={String(team.id)}
                                >
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          user.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {user.isActive ? t("active") : t("blocked")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canLockOrDeleteUser(user.role) ? (
                        <>
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
                            title={user.isActive ? t("blockUser") : t("unblockUser")}
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
                            title={t("deleteUserFromDatabase")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("protected")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!activeUsers.length && (
            <div className="text-center py-8 text-muted-foreground">
              {t("noActiveUsers")}
            </div>
          )}
        </div>

        <section>
          <h2 className="mb-3 text-lg font-semibold">
            {t("blockedUsers", { count: blockedUsers.length })}
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
                {canLockOrDeleteUser(user.role) ? (
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
                      {t("unblockUser")}
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
                      {t("delete")}
                    </Button>
                  </div>
                ) : (
                  <span className="ml-3 text-xs text-muted-foreground">
                    {t("protected")}
                  </span>
                )}
              </div>
            ))}
            {!blockedUsers.length && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("noBlockedUsers")}
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
                {t("changeRole")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("changeRoleDescription", {
                  role: roleLabel(roleChangeValue),
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRoleChange}
                disabled={updateRole.isPending}
              >
                {updateRole.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("updating")}
                  </>
                ) : (
                  t("confirm")
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
                  ? t("approveRequest")
                  : t("rejectRequest")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {reviewRequest?.action === "approve"
                  ? t("approveRequestDescription", {
                      name: reviewRequest.name,
                      role: roleLabel(reviewRequest.requestedRole),
                    })
                  : t("rejectRequestDescription", {
                      name: reviewRequest?.name || "",
                    })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-3">
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
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
                  ? t("processing")
                  : reviewRequest?.action === "approve"
                    ? t("approve")
                    : t("reject")}
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
                {statusChange?.isActive ? t("unlockUser") : t("lockUser")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {statusChange?.isActive
                  ? t("unlockUserDescription", { name: statusChange.name })
                  : t("lockUserDescription", {
                      name: statusChange?.name || "",
                    })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
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
                    {t("updating")}
                  </>
                ) : (
                  statusChange?.isActive ? t("unblockUser") : t("blockUser")
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
              <AlertDialogTitle>{t("deleteFromDatabase")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteFromDatabaseDescription", {
                  name: deleteUser?.name || "",
                  email: deleteUser?.email || "",
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handlePermanentDelete}
                disabled={deleteUserPermanently.isPending}
                className="bg-red-700 hover:bg-red-800"
              >
                {deleteUserPermanently.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("deleting")}
                  </>
                ) : (
                  t("deletePermanently")
                )}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
