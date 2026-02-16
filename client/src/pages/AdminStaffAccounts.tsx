import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminStaffLayout from "@/components/AdminStaffLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCog } from "lucide-react";
import type { AdminAccount, AccountFormData, Role, Field } from "./admin-staff/types";
import { fetchWithAdminAuth, createEmptyFormData } from "./admin-staff/types";
import { AccountFormDialog } from "./admin-staff/AccountFormDialog";
import { AccountTable } from "./admin-staff/AccountTable";
import { ResetPasswordDialog, ApproveAccountDialog } from "./admin-staff/AccountActionDialogs";

export default function AdminStaffAccounts() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [resetPasswordAccount, setResetPasswordAccount] = useState<AdminAccount | null>(null);
  const [approvingAccount, setApprovingAccount] = useState<AdminAccount | null>(null);
  const [approveRoleId, setApproveRoleId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [formData, setFormData] = useState<AccountFormData>(createEmptyFormData());

  // 資料查詢
  const { data: accounts, isLoading: accountsLoading } = useQuery<AdminAccount[]>({
    queryKey: ["/api/admin/accounts"],
    queryFn: () => fetchWithAdminAuth("/api/admin/accounts"),
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: () => fetchWithAdminAuth("/api/admin/roles"),
  });

  const { data: fields } = useQuery<Field[]>({
    queryKey: ["/api/admin/fields"],
    queryFn: () => fetchWithAdminAuth("/api/admin/fields"),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: AccountFormData) =>
      fetchWithAdminAuth("/api/admin/accounts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      closeDialog();
      toast({ title: "帳號新增成功" });
    },
    onError: (error: Error) => {
      toast({ title: "新增失敗", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<AccountFormData> }) =>
      fetchWithAdminAuth(`/api/admin/accounts/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify(data.updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      closeDialog();
      toast({ title: "帳號更新成功" });
    },
    onError: (error: Error) => {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: { id: string; newPassword: string }) =>
      fetchWithAdminAuth(`/api/admin/accounts/${data.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: data.newPassword }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      setResetPasswordAccount(null);
      setNewPassword("");
      toast({ title: "密碼重設成功" });
    },
    onError: (error: Error) => {
      toast({ title: "重設失敗", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (data: { id: string; roleId: string }) =>
      fetchWithAdminAuth(`/api/admin/accounts/${data.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ roleId: data.roleId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      setApprovingAccount(null);
      setApproveRoleId("");
      toast({ title: "帳號已授權" });
    },
    onError: (error: Error) => {
      toast({ title: "授權失敗", description: error.message, variant: "destructive" });
    },
  });

  // 操作處理
  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingAccount(null);
    setFormData(createEmptyFormData());
  };

  const handleEdit = (account: AdminAccount) => {
    setEditingAccount(account);
    setFormData({
      username: account.username,
      password: "",
      displayName: account.displayName || "",
      email: account.email || "",
      roleId: account.roleId || "",
      fieldId: account.fieldId,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      toast({ title: "請填寫帳號", variant: "destructive" });
      return;
    }
    if (!editingAccount && !formData.password.trim()) {
      toast({ title: "請填寫密碼", variant: "destructive" });
      return;
    }
    if (editingAccount) {
      const { password: _pw, fieldId: _fid, ...updates } = formData;
      updateMutation.mutate({ id: editingAccount.id, updates });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <AdminStaffLayout>
      <div className="p-6 space-y-6">
        {/* 標題列 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserCog className="w-6 h-6" />
              管理員帳號
            </h1>
            <p className="text-muted-foreground mt-1">
              管理系統管理員的帳號和權限
            </p>
          </div>

          <AccountFormDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            editingAccount={editingAccount}
            formData={formData}
            onFormDataChange={setFormData}
            onSubmit={handleSubmit}
            onClose={closeDialog}
            roles={roles}
            fields={fields}
            isPending={createMutation.isPending || updateMutation.isPending}
          />
        </div>

        {/* 帳號表格 */}
        <Card>
          <CardHeader>
            <CardTitle>帳號列表</CardTitle>
            <CardDescription>所有管理員帳號</CardDescription>
          </CardHeader>
          <CardContent>
            <AccountTable
              accounts={accounts}
              isLoading={accountsLoading}
              roles={roles}
              onEdit={handleEdit}
              onResetPassword={setResetPasswordAccount}
              onApprove={(account, defaultRoleId) => {
                setApprovingAccount(account);
                setApproveRoleId(defaultRoleId);
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* 重設密碼 Dialog */}
      <ResetPasswordDialog
        account={resetPasswordAccount}
        onClose={() => setResetPasswordAccount(null)}
        newPassword={newPassword}
        onNewPasswordChange={setNewPassword}
        onConfirm={() => {
          if (resetPasswordAccount) {
            resetPasswordMutation.mutate({
              id: resetPasswordAccount.id,
              newPassword,
            });
          }
        }}
        isPending={resetPasswordMutation.isPending}
      />

      {/* 授權帳號 Dialog */}
      <ApproveAccountDialog
        account={approvingAccount}
        onClose={() => setApprovingAccount(null)}
        approveRoleId={approveRoleId}
        onApproveRoleIdChange={setApproveRoleId}
        onConfirm={() => {
          if (approvingAccount) {
            approveMutation.mutate({
              id: approvingAccount.id,
              roleId: approveRoleId,
            });
          }
        }}
        roles={roles}
        isPending={approveMutation.isPending}
      />
    </AdminStaffLayout>
  );
}
