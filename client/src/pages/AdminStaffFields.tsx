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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Pencil, MapPin, Phone, Mail, Lock, Unlock, AlertTriangle } from "lucide-react";

interface AdminInfo {
  systemRole: string;
}

interface Field {
  id: string;
  code: string;
  name: string;
  address: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  description: string | null;
  status: string;
  codeLastChangedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
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

export default function AdminStaffFields() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [isCodeUnlocked, setIsCodeUnlocked] = useState(false);
  const [showUnlockWarning, setShowUnlockWarning] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    address: "",
    contactPhone: "",
    contactEmail: "",
    description: "",
  });

  const { data: adminInfo } = useQuery<AdminInfo>({
    queryKey: ["/api/admin/me"],
    queryFn: () => fetchWithAdminAuth("/api/admin/me"),
  });

  const { data: fields, isLoading } = useQuery<Field[]>({
    queryKey: ["/api/admin/fields"],
    queryFn: () => fetchWithAdminAuth("/api/admin/fields"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => 
      fetchWithAdminAuth("/api/admin/fields", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fields"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "場域新增成功" });
    },
    onError: (error: Error) => {
      toast({ title: "新增失敗", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<typeof formData> }) => 
      fetchWithAdminAuth(`/api/admin/fields/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify(data.updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fields"] });
      setIsDialogOpen(false);
      setEditingField(null);
      setIsCodeUnlocked(false);
      resetForm();
      toast({ title: "場域更新成功" });
    },
    onError: (error: Error) => {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      address: "",
      contactPhone: "",
      contactEmail: "",
      description: "",
    });
    setIsCodeUnlocked(false);
  };

  const handleEdit = (field: Field) => {
    setEditingField(field);
    setFormData({
      code: field.code,
      name: field.name,
      address: field.address || "",
      contactPhone: field.contactPhone || "",
      contactEmail: field.contactEmail || "",
      description: field.description || "",
    });
    setIsCodeUnlocked(false);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code.trim() || !formData.name.trim()) {
      toast({ title: "請填寫必填欄位", variant: "destructive" });
      return;
    }

    if (editingField) {
      const updates: Partial<typeof formData> = { ...formData };
      if (!isCodeUnlocked || formData.code === editingField.code) {
        delete updates.code;
      }
      updateMutation.mutate({ id: editingField.id, updates });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingField(null);
    setIsCodeUnlocked(false);
    resetForm();
  };

  const handleUnlockCode = () => {
    setShowUnlockWarning(true);
  };

  const confirmUnlock = () => {
    setIsCodeUnlocked(true);
    setShowUnlockWarning(false);
  };

  const canChangeCode = () => {
    if (!editingField) return true;
    if (adminInfo?.systemRole === "super_admin") return true;
    
    if (editingField.codeLastChangedAt) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return new Date(editingField.codeLastChangedAt) <= sixMonthsAgo;
    }
    return true;
  };

  const getNextChangeDate = () => {
    if (!editingField?.codeLastChangedAt) return null;
    const nextDate = new Date(editingField.codeLastChangedAt);
    nextDate.setMonth(nextDate.getMonth() + 6);
    return nextDate;
  };

  const isSuperAdmin = adminInfo?.systemRole === "super_admin";

  return (
    <AdminStaffLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6" />
              場域管理
            </h1>
            <p className="text-muted-foreground mt-1">管理遊戲場域的基本資訊</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-field">
                <Plus className="w-4 h-4 mr-2" />
                新增場域
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingField ? "編輯場域" : "新增場域"}</DialogTitle>
                <DialogDescription>
                  {editingField ? "更新場域資訊" : "填寫新場域的基本資訊"}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code" className="flex items-center gap-2">
                      場域編號 *
                      {editingField && !isCodeUnlocked && (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="code"
                        data-testid="input-field-code"
                        placeholder="例如: JIACHUN"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        disabled={!!editingField && !isCodeUnlocked}
                        className={editingField && !isCodeUnlocked ? "bg-muted" : ""}
                      />
                      {editingField && !isCodeUnlocked && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleUnlockCode}
                          data-testid="button-unlock-code"
                          title="解鎖變更場域編號"
                        >
                          <Unlock className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {editingField && !isCodeUnlocked && !canChangeCode() && !isSuperAdmin && (
                      <p className="text-xs text-muted-foreground">
                        下次可變更：{getNextChangeDate()?.toLocaleDateString("zh-TW")}
                      </p>
                    )}
                    {editingField && isCodeUnlocked && (
                      <p className="text-xs text-amber-500 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        場域編號已解鎖，變更後將影響登入流程
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="name">場域名稱 *</Label>
                    <Input
                      id="name"
                      data-testid="input-field-name"
                      placeholder="例如: 賈村競技體驗場"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address">地址</Label>
                  <Input
                    id="address"
                    data-testid="input-field-address"
                    placeholder="場域地址"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">聯絡電話</Label>
                    <Input
                      id="contactPhone"
                      data-testid="input-field-phone"
                      placeholder="電話號碼"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">聯絡信箱</Label>
                    <Input
                      id="contactEmail"
                      data-testid="input-field-email"
                      type="email"
                      placeholder="電子郵件"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Textarea
                    id="description"
                    data-testid="input-field-description"
                    placeholder="場域描述..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    取消
                  </Button>
                  <Button 
                    type="submit" 
                    data-testid="button-submit-field"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? "處理中..." : (editingField ? "更新" : "新增")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>場域列表</CardTitle>
            <CardDescription>所有可管理的遊戲場域</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : fields && fields.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>場域編號</TableHead>
                    <TableHead>名稱</TableHead>
                    <TableHead>地址</TableHead>
                    <TableHead>聯絡資訊</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field) => (
                    <TableRow key={field.id} data-testid={`row-field-${field.id}`}>
                      <TableCell className="font-mono font-medium">{field.code}</TableCell>
                      <TableCell>{field.name}</TableCell>
                      <TableCell>
                        {field.address ? (
                          <span className="flex items-center gap-1 text-sm">
                            <MapPin className="w-3 h-3" />
                            {field.address}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {field.contactPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {field.contactPhone}
                            </span>
                          )}
                          {field.contactEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {field.contactEmail}
                            </span>
                          )}
                          {!field.contactPhone && !field.contactEmail && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={field.status === "active" ? "default" : "secondary"}>
                          {field.status === "active" ? "營運中" : "停用"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-edit-field-${field.id}`}
                          onClick={() => handleEdit(field)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>尚無場域資料</p>
                <p className="text-sm">點擊「新增場域」開始建立</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showUnlockWarning} onOpenChange={setShowUnlockWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              確認解鎖場域編號？
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>變更場域編號會影響以下功能：</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>管理員需要使用新的場域編號登入</li>
                <li>相關的 QR Code 連結可能需要重新產生</li>
                {!isSuperAdmin && <li className="text-amber-600">六個月內將無法再次變更場域編號</li>}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlock} data-testid="button-confirm-unlock">
              確認解鎖
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminStaffLayout>
  );
}
