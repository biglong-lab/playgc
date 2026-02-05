import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminStaffLayout from "@/components/AdminStaffLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserCog, Plus, Pencil, KeyRound, Eye, EyeOff, UserCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Role {
  id: string;
  name: string;
  systemRole: string;
}

interface Field {
  id: string;
  code: string;
  name: string;
}

interface AdminAccount {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  status: string;
  roleId: string | null;
  fieldId: string;
  lastLoginAt: string | null;
  createdAt: string;
  role: Role | null;
  field: Field | null;
}

async function fetchWithAdminAuth(url: string, options: RequestInit = {}) {
  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
  };
  
  const response = await fetch(url, { ...options, headers, credentials: "include" });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }
  
  return response.json();
}

const STATUS_LABELS: Record<string, string> = {
  active: "啟用中",
  inactive: "停用",
  locked: "鎖定",
  pending: "待授權",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  inactive: "secondary",
  locked: "destructive",
  pending: "outline",
};

export default function AdminStaffAccounts() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [resetPasswordAccount, setResetPasswordAccount] = useState<AdminAccount | null>(null);
  const [approvingAccount, setApprovingAccount] = useState<AdminAccount | null>(null);
  const [approveRoleId, setApproveRoleId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    displayName: "",
    email: "",
    roleId: "",
    fieldId: "",
  });

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

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => 
      fetchWithAdminAuth("/api/admin/accounts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "帳號新增成功" });
    },
    onError: (error: Error) => {
      toast({ title: "新增失敗", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<typeof formData> }) => 
      fetchWithAdminAuth(`/api/admin/accounts/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify(data.updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      setIsDialogOpen(false);
      setEditingAccount(null);
      resetForm();
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

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      displayName: "",
      email: "",
      roleId: "",
      fieldId: "",
    });
    setShowPassword(false);
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
      const { password, fieldId, ...updates } = formData;
      updateMutation.mutate({ id: editingAccount.id, updates });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingAccount(null);
    resetForm();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("zh-TW");
  };

  return (
    <AdminStaffLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserCog className="w-6 h-6" />
              管理員帳號
            </h1>
            <p className="text-muted-foreground mt-1">管理系統管理員的帳號和權限</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-account">
                <Plus className="w-4 h-4 mr-2" />
                新增帳號
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingAccount ? "編輯帳號" : "新增管理員帳號"}</DialogTitle>
                <DialogDescription>
                  {editingAccount ? "更新管理員帳號資訊" : "建立新的管理員帳號"}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingAccount && fields && fields.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="fieldId">所屬場域</Label>
                    <Select
                      value={formData.fieldId}
                      onValueChange={(value) => setFormData({ ...formData, fieldId: value })}
                    >
                      <SelectTrigger data-testid="select-field">
                        <SelectValue placeholder="選擇場域" />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.name} ({field.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">帳號 *</Label>
                    <Input
                      id="username"
                      data-testid="input-account-username"
                      placeholder="登入帳號"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      disabled={!!editingAccount}
                    />
                  </div>
                  
                  {!editingAccount && (
                    <div className="space-y-2">
                      <Label htmlFor="password">密碼 *</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          data-testid="input-account-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="登入密碼"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">顯示名稱</Label>
                    <Input
                      id="displayName"
                      data-testid="input-account-displayname"
                      placeholder="顯示名稱"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">電子郵件</Label>
                    <Input
                      id="email"
                      data-testid="input-account-email"
                      type="email"
                      placeholder="電子郵件"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="roleId">角色</Label>
                  <Select
                    value={formData.roleId}
                    onValueChange={(value) => setFormData({ ...formData, roleId: value })}
                  >
                    <SelectTrigger data-testid="select-role">
                      <SelectValue placeholder="選擇角色" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    取消
                  </Button>
                  <Button 
                    type="submit" 
                    data-testid="button-submit-account"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? "處理中..." : (editingAccount ? "更新" : "新增")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>帳號列表</CardTitle>
            <CardDescription>所有管理員帳號</CardDescription>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : accounts && accounts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>帳號</TableHead>
                    <TableHead>顯示名稱</TableHead>
                    <TableHead>場域</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>最後登入</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id} data-testid={`row-account-${account.id}`}>
                      <TableCell className="font-mono">{account.username || <span className="text-muted-foreground italic">（Firebase 登入）</span>}</TableCell>
                      <TableCell>{account.displayName || "-"}</TableCell>
                      <TableCell>
                        {account.field ? (
                          <Badge variant="outline">{account.field.code}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {account.role ? (
                          <Badge>{account.role.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">未指派</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[account.status] || "secondary"}>
                          {STATUS_LABELS[account.status] || account.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(account.lastLoginAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {account.status === "pending" && (
                            <Button
                              variant="default"
                              size="sm"
                              data-testid={`button-approve-account-${account.id}`}
                              onClick={() => {
                                setApprovingAccount(account);
                                const defaultRole = roles?.find(r => r.systemRole === "field_executor");
                                setApproveRoleId(defaultRole?.id || "");
                              }}
                            >
                              <UserCheck className="w-4 h-4 mr-1" />
                              授權
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-edit-account-${account.id}`}
                            onClick={() => handleEdit(account)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-reset-password-${account.id}`}
                            onClick={() => setResetPasswordAccount(account)}
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <UserCog className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>尚無帳號資料</p>
                <p className="text-sm">點擊「新增帳號」開始建立</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!resetPasswordAccount} onOpenChange={() => setResetPasswordAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重設密碼</AlertDialogTitle>
            <AlertDialogDescription>
              為帳號「{resetPasswordAccount?.username}」設定新密碼
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2 py-4">
            <Label htmlFor="newPassword">新密碼</Label>
            <Input
              id="newPassword"
              data-testid="input-new-password"
              type="password"
              placeholder="請輸入新密碼（至少 6 個字元）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewPassword("")}>取消</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-reset-password"
              onClick={() => {
                if (resetPasswordAccount && newPassword.length >= 6) {
                  resetPasswordMutation.mutate({ 
                    id: resetPasswordAccount.id, 
                    newPassword 
                  });
                } else {
                  toast({ title: "密碼至少需要 6 個字元", variant: "destructive" });
                }
              }}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? "處理中..." : "確認重設"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!approvingAccount} onOpenChange={() => { setApprovingAccount(null); setApproveRoleId(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>授權帳號</AlertDialogTitle>
            <AlertDialogDescription>
              授權「{approvingAccount?.displayName || approvingAccount?.email || approvingAccount?.username || "此帳號"}」，請選擇要指派的角色
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2 py-4">
            <Label htmlFor="approveRole">指派角色</Label>
            <Select value={approveRoleId} onValueChange={setApproveRoleId}>
              <SelectTrigger data-testid="select-approve-role">
                <SelectValue placeholder="選擇角色（可選）" />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              請選擇一個角色以授權此帳號
            </p>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setApproveRoleId("")}>取消</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-approve"
              onClick={() => {
                if (!approveRoleId) {
                  toast({ title: "請選擇角色", variant: "destructive" });
                  return;
                }
                if (approvingAccount) {
                  approveMutation.mutate({ 
                    id: approvingAccount.id, 
                    roleId: approveRoleId 
                  });
                }
              }}
              disabled={approveMutation.isPending || !approveRoleId}
            >
              {approveMutation.isPending ? "處理中..." : "確認授權"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminStaffLayout>
  );
}
