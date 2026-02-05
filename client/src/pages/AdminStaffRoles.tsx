import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminStaffLayout from "@/components/AdminStaffLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Key, Plus, Pencil, Trash2, Shield, Crown, Users, Wrench, Eye } from "lucide-react";
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

interface Permission {
  id: string;
  key: string;
  description: string;
  category: string;
}

interface RolePermission {
  permissionId: string;
  permission: Permission;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  systemRole: string;
  isCustom: boolean;
  fieldId: string | null;
  rolePermissions: RolePermission[];
  createdAt: string;
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

const SYSTEM_ROLE_ICONS: Record<string, typeof Shield> = {
  super_admin: Crown,
  field_manager: Shield,
  field_director: Users,
  field_executor: Wrench,
  custom: Eye,
};

const SYSTEM_ROLE_LABELS: Record<string, string> = {
  super_admin: "超級管理員",
  field_manager: "場域管理員",
  field_director: "場域主管",
  field_executor: "場域執行者",
  custom: "自訂角色",
};

const CATEGORY_LABELS: Record<string, string> = {
  game: "遊戲管理",
  page: "頁面管理",
  item: "道具管理",
  session: "場次管理",
  device: "設備管理",
  analytics: "數據分析",
  leaderboard: "排行榜",
  user: "用戶管理",
  field: "場域管理",
  admin: "管理員",
  qr: "QR Code",
  system: "系統",
};

export default function AdminStaffRoles() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissionIds: [] as string[],
  });

  const { data: roles, isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: () => fetchWithAdminAuth("/api/admin/roles"),
  });

  const { data: permissions } = useQuery<Permission[]>({
    queryKey: ["/api/admin/permissions"],
    queryFn: () => fetchWithAdminAuth("/api/admin/permissions"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => 
      fetchWithAdminAuth("/api/admin/roles", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "角色新增成功" });
    },
    onError: (error: Error) => {
      toast({ title: "新增失敗", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: typeof formData }) => 
      fetchWithAdminAuth(`/api/admin/roles/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify(data.updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      setIsDialogOpen(false);
      setEditingRole(null);
      resetForm();
      toast({ title: "角色更新成功" });
    },
    onError: (error: Error) => {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      fetchWithAdminAuth(`/api/admin/roles/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      setDeleteRole(null);
      toast({ title: "角色刪除成功" });
    },
    onError: (error: Error) => {
      toast({ title: "刪除失敗", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      permissionIds: [],
    });
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      permissionIds: role.rolePermissions.map(rp => rp.permissionId),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({ title: "請填寫角色名稱", variant: "destructive" });
      return;
    }

    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingRole(null);
    resetForm();
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter(id => id !== permissionId)
        : [...prev.permissionIds, permissionId],
    }));
  };

  const permissionsByCategory = permissions?.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>) || {};

  return (
    <AdminStaffLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Key className="w-6 h-6" />
              角色管理
            </h1>
            <p className="text-muted-foreground mt-1">管理系統角色和權限設定</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-role">
                <Plus className="w-4 h-4 mr-2" />
                新增角色
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRole ? "編輯角色" : "新增角色"}</DialogTitle>
                <DialogDescription>
                  {editingRole ? "更新角色資訊和權限" : "建立新的自訂角色並設定權限"}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">角色名稱 *</Label>
                  <Input
                    id="name"
                    data-testid="input-role-name"
                    placeholder="例如: 活動助理"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">角色描述</Label>
                  <Textarea
                    id="description"
                    data-testid="input-role-description"
                    placeholder="描述這個角色的職責..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>權限設定</Label>
                  <Accordion type="multiple" className="w-full">
                    {Object.entries(permissionsByCategory).map(([category, perms]) => (
                      <AccordionItem key={category} value={category}>
                        <AccordionTrigger className="text-sm">
                          <div className="flex items-center gap-2">
                            <span>{CATEGORY_LABELS[category] || category}</span>
                            <Badge variant="secondary" className="text-xs">
                              {perms.filter(p => formData.permissionIds.includes(p.id)).length}/{perms.length}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pl-4">
                            {perms.map((perm) => (
                              <div key={perm.id} className="flex items-start gap-2">
                                <Checkbox
                                  id={perm.id}
                                  data-testid={`checkbox-perm-${perm.key}`}
                                  checked={formData.permissionIds.includes(perm.id)}
                                  onCheckedChange={() => togglePermission(perm.id)}
                                />
                                <div className="grid gap-0.5 leading-none">
                                  <label
                                    htmlFor={perm.id}
                                    className="text-sm font-medium cursor-pointer"
                                  >
                                    {perm.key}
                                  </label>
                                  <p className="text-xs text-muted-foreground">
                                    {perm.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    取消
                  </Button>
                  <Button 
                    type="submit" 
                    data-testid="button-submit-role"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? "處理中..." : (editingRole ? "更新" : "新增")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>角色列表</CardTitle>
            <CardDescription>系統角色與自訂角色的權限配置</CardDescription>
          </CardHeader>
          <CardContent>
            {rolesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : roles && roles.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>角色</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead>權限數量</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => {
                    const RoleIcon = SYSTEM_ROLE_ICONS[role.systemRole] || Eye;
                    return (
                      <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <RoleIcon className="w-4 h-4" />
                            <span className="font-medium">{role.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={role.isCustom ? "outline" : "default"}>
                            {SYSTEM_ROLE_LABELS[role.systemRole] || role.systemRole}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {role.systemRole === "super_admin" ? "全部" : role.rolePermissions.length}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {role.description || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {role.isCustom && (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-edit-role-${role.id}`}
                                onClick={() => handleEdit(role)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-role-${role.id}`}
                                onClick={() => setDeleteRole(role)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>尚無角色資料</p>
                <p className="text-sm">點擊「新增角色」開始建立</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteRole} onOpenChange={() => setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除角色</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除角色「{deleteRole?.name}」嗎？此操作無法復原。
              已指派此角色的管理員帳號將失去相關權限。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-role"
              onClick={() => deleteRole && deleteMutation.mutate(deleteRole.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "刪除中..." : "確認刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminStaffLayout>
  );
}
