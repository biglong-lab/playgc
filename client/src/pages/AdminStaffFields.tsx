import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Building2, Plus, Pencil, MapPin, Phone, Mail, Lock, Unlock, AlertTriangle,
  Target, Swords, Camera, BookOpen, DollarSign,
  ExternalLink, Megaphone,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { fetchWithAdminAuth } from "./admin-staff/types";
import type { FieldSettings } from "@shared/schema";

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
  /** 🆕 後端回的 jsonb 原始資料，用來推出模組啟用狀態 */
  settings?: FieldSettings | null;
}

/** 🆕 6 個模組徽章定義（對應 FieldSettings 的 enableXxx） */
const MODULE_BADGES: Array<{
  key: keyof FieldSettings;
  label: string;
  short: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "enableShootingMission", label: "射擊", short: "射", Icon: Target },
  { key: "enableBattleArena",     label: "對戰", short: "戰", Icon: Swords },
  { key: "enableGpsMission",      label: "GPS",  short: "G",  Icon: MapPin },
  { key: "enablePhotoMission",    label: "拍照", short: "照", Icon: Camera },
  { key: "enableChapters",        label: "章節", short: "章", Icon: BookOpen },
  { key: "enablePayment",         label: "收費", short: "費", Icon: DollarSign },
];

/** 🆕 從場域 settings 推出啟用的模組 count + badges 清單 */
function getFieldModuleStatus(settings?: FieldSettings | null) {
  const s = settings ?? {};
  const enabled = MODULE_BADGES.filter((b) => s[b.key] === true);
  return { enabled, total: MODULE_BADGES.length };
}

/** 🆕 判斷場域是否有「目前生效中」的公告（與 server isAnnouncementActive 邏輯一致） */
function hasActiveAnnouncement(settings?: FieldSettings | null): boolean {
  if (!settings?.announcement?.trim()) return false;
  const today = new Date().toISOString().split("T")[0];
  if (settings.announcementStartAt && today < settings.announcementStartAt) return false;
  if (settings.announcementEndAt && today > settings.announcementEndAt) return false;
  return true;
}

export default function AdminStaffFields() {
  const { isAuthenticated } = useAdminAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [isCodeUnlocked, setIsCodeUnlocked] = useState(false);
  const [showUnlockWarning, setShowUnlockWarning] = useState(false);
  // 🆕 新增場域時可選「從範本複製設定」
  const [templateFieldId, setTemplateFieldId] = useState<string>("");
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
    enabled: isAuthenticated,
  });

  const { data: fields, isLoading } = useQuery<Field[]>({
    queryKey: ["/api/admin/fields"],
    queryFn: () => fetchWithAdminAuth("/api/admin/fields"),
    enabled: isAuthenticated,
  });

  // 🆕 模組 filter — 只看啟用該模組的場域
  const [moduleFilter, setModuleFilter] = useState<"all" | keyof FieldSettings>("all");
  // 🆕 排序
  type SortKey = "created_desc" | "created_asc" | "name" | "modules_desc" | "modules_asc";
  const [sortBy, setSortBy] = useState<SortKey>("created_desc");

  const filteredFields = useMemo(() => {
    if (!fields) return [];
    const filtered = moduleFilter === "all"
      ? [...fields]
      : fields.filter((f) => f.settings?.[moduleFilter] === true);

    // 依 sortBy 排序
    filtered.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "zh-Hant");
      if (sortBy === "created_asc") return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
      if (sortBy === "modules_desc" || sortBy === "modules_asc") {
        const ca = getFieldModuleStatus(a.settings).enabled.length;
        const cb = getFieldModuleStatus(b.settings).enabled.length;
        return sortBy === "modules_desc" ? cb - ca : ca - cb;
      }
      // 預設 created_desc
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });

    return filtered;
  }, [fields, moduleFilter, sortBy]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // 1. 建立新場域
      const created = await fetchWithAdminAuth("/api/admin/fields", {
        method: "POST",
        body: JSON.stringify(data),
      }) as Field;

      // 🆕 2. 若選了範本場域，複製其 settings（模組 / 亮點 / 主題 / tagline）
      if (templateFieldId && fields && created?.id) {
        const source = fields.find((f) => f.id === templateFieldId);
        const s = source?.settings;
        if (s) {
          // 只複製「可複製」的設定；排除 AI key 等敏感/個別欄位
          const settingsToApply: Partial<FieldSettings> = {
            enableShootingMission: s.enableShootingMission,
            enableBattleArena: s.enableBattleArena,
            enableGpsMission: s.enableGpsMission,
            enablePhotoMission: s.enablePhotoMission,
            enableChapters: s.enableChapters,
            enablePayment: s.enablePayment,
            enableTeamMode: s.enableTeamMode,
            enableCompetitiveMode: s.enableCompetitiveMode,
            highlights: s.highlights,
            tagline: s.tagline,
            welcomeMessage: s.welcomeMessage,
            theme: s.theme,
          };
          await fetchWithAdminAuth(`/api/admin/fields/${created.id}/settings`, {
            method: "PATCH",
            body: JSON.stringify(settingsToApply),
          });
        }
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fields"] });
      setIsDialogOpen(false);
      resetForm();
      const source = fields?.find((f) => f.id === templateFieldId);
      toast({
        title: "場域新增成功",
        description: source
          ? `已從「${source.name}」複製模組/亮點/主題設定`
          : undefined,
      });
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
    setTemplateFieldId(""); // 🆕 清空範本選擇
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
    <UnifiedAdminLayout title="場域管理">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
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

                {/* 🆕 新增場域時可選「從現有場域複製設定」— 編輯模式不顯示 */}
                {!editingField && fields && fields.length > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="template">
                      套用設定範本
                      <span className="text-xs text-muted-foreground ml-2 font-normal">
                        （可選 · 複製模組/亮點/主題）
                      </span>
                    </Label>
                    <Select value={templateFieldId} onValueChange={setTemplateFieldId}>
                      <SelectTrigger data-testid="select-template-field">
                        <SelectValue placeholder="從空白開始（不複製）" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">從空白開始（不複製）</SelectItem>
                        {fields.map((f) => {
                          const { enabled, total } = getFieldModuleStatus(f.settings);
                          return (
                            <SelectItem key={f.id} value={f.id}>
                              <div className="flex items-center justify-between gap-3 min-w-[260px]">
                                <span>{f.name}</span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {enabled.length}/{total} 模組
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      會複製：模組開關 · 場域亮點 · 視覺主題 · Tagline · 歡迎訊息。
                      <br />
                      <span className="text-amber-600">
                        不複製：AI Key、聯絡資訊、場域編號與名稱。
                      </span>
                    </p>
                  </div>
                )}

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
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <CardTitle>場域列表</CardTitle>
                <CardDescription>所有可管理的遊戲場域</CardDescription>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* 🆕 模組 filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">過濾：</span>
                  <Select
                    value={moduleFilter}
                    onValueChange={(v) => setModuleFilter(v as typeof moduleFilter)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-module-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部場域</SelectItem>
                      {MODULE_BADGES.map((m) => (
                        <SelectItem key={String(m.key)} value={String(m.key)}>
                          <div className="flex items-center gap-2">
                            <m.Icon className="w-3.5 h-3.5" />
                            啟用{m.label}的場域
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fields && moduleFilter !== "all" && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {filteredFields.length}/{fields.length}
                    </span>
                  )}
                </div>
                {/* 🆕 排序 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">排序：</span>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                    <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_desc">最新建立</SelectItem>
                      <SelectItem value="created_asc">最舊優先</SelectItem>
                      <SelectItem value="name">場域名稱 A→Z</SelectItem>
                      <SelectItem value="modules_desc">模組數 多→少</SelectItem>
                      <SelectItem value="modules_asc">模組數 少→多</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton count={5} />
            ) : filteredFields && filteredFields.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>場域編號</TableHead>
                    <TableHead>名稱</TableHead>
                    <TableHead>聯絡資訊</TableHead>
                    <TableHead>啟用模組</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFields.map((field) => {
                    const { enabled, total } = getFieldModuleStatus(field.settings);
                    return (
                      <TableRow key={field.id} data-testid={`row-field-${field.id}`}>
                        <TableCell className="font-mono font-medium">{field.code}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{field.name}</div>
                            {field.address && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                {field.address}
                              </div>
                            )}
                            {/* 🆕 公告狀態指示 */}
                            {hasActiveAnnouncement(field.settings) && (
                              <div
                                className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1"
                                title={field.settings?.announcement || ""}
                                data-testid={`announcement-indicator-${field.code}`}
                              >
                                <Megaphone className="w-3 h-3" />
                                <span className="truncate max-w-[160px]">
                                  公告：{field.settings?.announcement}
                                </span>
                              </div>
                            )}
                          </div>
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
                          {/* 🆕 6 個模組徽章：啟用原色 primary，未啟用灰色淡化 */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {MODULE_BADGES.map((m) => {
                              const isEnabled = field.settings?.[m.key] === true;
                              return (
                                <div
                                  key={m.key}
                                  className={`w-7 h-7 rounded-md flex items-center justify-center border transition-all ${
                                    isEnabled
                                      ? "bg-primary/10 border-primary/40 text-primary"
                                      : "bg-muted/50 border-muted-foreground/20 text-muted-foreground/40"
                                  }`}
                                  title={`${m.label}：${isEnabled ? "已啟用" : "未啟用"}`}
                                  data-testid={`field-${field.code}-module-${m.key}`}
                                >
                                  <m.Icon className="w-3.5 h-3.5" />
                                </div>
                              );
                            })}
                            <span className="ml-1.5 text-xs text-muted-foreground font-mono">
                              {enabled.length}/{total}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={field.status === "active" ? "default" : "secondary"}>
                            {field.status === "active" ? "營運中" : "停用"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* 🆕 一鍵預覽前台（新分頁開） */}
                            {field.status === "active" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                title="新分頁預覽前台"
                                data-testid={`button-preview-${field.code}`}
                              >
                                <a
                                  href={`/f/${field.code}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`預覽 ${field.name} 前台`}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="編輯場域"
                              data-testid={`button-edit-field-${field.id}`}
                              onClick={() => handleEdit(field)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={Building2}
                title="尚無場域資料"
                description="點擊右上角「新增場域」開始建立第一個場域"
                actions={[
                  {
                    label: "新增場域",
                    onClick: () => setIsDialogOpen(true),
                  },
                ]}
              />
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
    </UnifiedAdminLayout>
  );
}
