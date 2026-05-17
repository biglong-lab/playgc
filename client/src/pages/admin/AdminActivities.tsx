// 🎯 Admin 活動管理（2026-05-18）
//
// 業主可建多個活動（射擊體驗 / 水彈對戰 / 實境闖關 / 文化導覽…）
// 每個活動：封面 + 定價 + 時長 + 容量 + 付款模式
//
// 玩家端：/book/:fieldCode 看到卡片列表、各自獨立預約頁

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Calendar, Image as ImageIcon, Activity as ActivityIcon, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import ScheduleEditor, { type ScheduleTemplate } from "./booking/ScheduleEditor";

interface Activity {
  id: string;
  fieldId: string;
  slug: string;
  name: string;
  shortDesc?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  locationNote?: string | null;
  priceCents: number;
  currency: string;
  durationMinutes: number;
  capacityPerSlot: number;
  paymentMode: "online" | "onsite" | "both";
  isActive: boolean;
  sortOrder: number;
}

interface ActivityForm {
  slug: string;
  name: string;
  shortDesc: string;
  description: string;
  coverUrl: string;
  locationNote: string;
  priceCents: number;
  durationMinutes: number;
  capacityPerSlot: number;
  paymentMode: "online" | "onsite" | "both";
  isActive: boolean;
}

const EMPTY_FORM: ActivityForm = {
  slug: "",
  name: "",
  shortDesc: "",
  description: "",
  coverUrl: "",
  locationNote: "",
  priceCents: 0,
  durationMinutes: 60,
  capacityPerSlot: 1,
  paymentMode: "onsite",
  isActive: true,
};

const EMPTY_SCHEDULE: ScheduleTemplate = {
  rules: [],
  blackoutDates: [],
  notes: "",
  version: 1,
};

export default function AdminActivities() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Activity | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ActivityForm>(EMPTY_FORM);
  const [schedulingActivityId, setSchedulingActivityId] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleTemplate>(EMPTY_SCHEDULE);

  const { data, isLoading } = useQuery<{ activities: Activity[] }>({
    queryKey: ["admin-activities"],
    queryFn: async () => await fetchWithAdminAuth("/api/admin/activities"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const isEdit = !!editing;
      const url = isEdit ? `/api/admin/activities/${editing.id}` : "/api/admin/activities";
      const body: Record<string, unknown> = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        shortDesc: form.shortDesc.trim() || null,
        description: form.description.trim() || null,
        coverUrl: form.coverUrl.trim() || null,
        locationNote: form.locationNote.trim() || null,
        priceCents: form.priceCents,
        durationMinutes: form.durationMinutes,
        capacityPerSlot: form.capacityPerSlot,
        paymentMode: form.paymentMode,
      };
      if (isEdit) body.isActive = form.isActive;
      await fetchWithAdminAuth(url, {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast({ title: editing ? "活動已更新" : "活動已新增" });
      qc.invalidateQueries({ queryKey: ["admin-activities"] });
      setEditing(null);
      setCreating(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "請重試";
      toast({ variant: "destructive", title: "儲存失敗", description: msg });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetchWithAdminAuth(`/api/admin/activities/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "已停用" });
      qc.invalidateQueries({ queryKey: ["admin-activities"] });
    },
  });

  const sortMutation = useMutation({
    mutationFn: async ({ id, sortOrder }: { id: string; sortOrder: number }) => {
      await fetchWithAdminAuth(`/api/admin/activities/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ sortOrder }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-activities"] }),
  });

  const moveActivity = (a: Activity, direction: "up" | "down") => {
    const list = data?.activities ?? [];
    const idx = list.findIndex((x) => x.id === a.id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const other = list[swapIdx];
    // 兩者 sortOrder 交換、若同值則上加一下加
    if (a.sortOrder === other.sortOrder) {
      sortMutation.mutate({ id: a.id, sortOrder: direction === "up" ? a.sortOrder - 1 : a.sortOrder + 1 });
    } else {
      sortMutation.mutate({ id: a.id, sortOrder: other.sortOrder });
      sortMutation.mutate({ id: other.id, sortOrder: a.sortOrder });
    }
  };

  const scheduleMutation = useMutation({
    mutationFn: async (template: ScheduleTemplate) => {
      if (!schedulingActivityId) throw new Error("無活動 id");
      await fetchWithAdminAuth(`/api/admin/activities/${schedulingActivityId}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({ scheduleTemplate: template }),
      });
    },
    onSuccess: () => {
      toast({ title: "活動時段已儲存" });
      setSchedulingActivityId(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "請重試";
      toast({ variant: "destructive", title: "儲存失敗", description: msg });
    },
  });

  // 進入時段編輯：先 fetch 現有 schedule（如果有）
  const openSchedule = async (activityId: string) => {
    setSchedulingActivityId(activityId);
    try {
      const res = (await fetchWithAdminAuth(`/api/admin/activities/${activityId}`)) as {
        schedule?: { scheduleTemplate: ScheduleTemplate } | null;
      };
      if (res.schedule?.scheduleTemplate) {
        setScheduleDraft(res.schedule.scheduleTemplate);
      } else {
        setScheduleDraft(EMPTY_SCHEDULE);
      }
    } catch {
      setScheduleDraft(EMPTY_SCHEDULE);
    }
  };

  const openEdit = (a: Activity) => {
    setEditing(a);
    setForm({
      slug: a.slug,
      name: a.name,
      shortDesc: a.shortDesc ?? "",
      description: a.description ?? "",
      coverUrl: a.coverUrl ?? "",
      locationNote: a.locationNote ?? "",
      priceCents: a.priceCents,
      durationMinutes: a.durationMinutes,
      capacityPerSlot: a.capacityPerSlot,
      paymentMode: a.paymentMode,
      isActive: a.isActive,
    });
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setCreating(true);
  };

  const closeDialog = () => {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_FORM);
  };

  return (
    <UnifiedAdminLayout title="活動管理">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          管理場域內的活動（射擊體驗 / 水彈對戰 / 實境闖關…），玩家會在預約頁看到啟用中的活動。
        </p>
        <Button onClick={openCreate} data-testid="button-add-activity">
          <Plus className="w-4 h-4 mr-1" />
          新增活動
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">載入中…</div>}

      {data?.activities?.length === 0 && (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            <ActivityIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>還沒建立活動</p>
            <Button className="mt-3" onClick={openCreate}>
              建立第一個活動
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.activities?.map((a) => (
          <Card key={a.id} className={!a.isActive ? "opacity-50" : ""}>
            {a.coverUrl ? (
              <img src={a.coverUrl} alt={a.name} className="w-full h-32 object-cover rounded-t-lg" />
            ) : (
              <div className="w-full h-32 bg-muted flex items-center justify-center rounded-t-lg">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{a.name}</CardTitle>
                {!a.isActive && <Badge variant="outline">已停用</Badge>}
              </div>
              <CardDescription className="text-xs">/{a.slug}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {a.shortDesc && <p className="text-xs text-muted-foreground line-clamp-2">{a.shortDesc}</p>}
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">NT${(a.priceCents / 100).toFixed(0)}</Badge>
                <Badge variant="secondary">{a.durationMinutes} 分</Badge>
                <Badge variant="secondary">{a.capacityPerSlot} 人/梯</Badge>
                <Badge variant="outline">
                  {a.paymentMode === "online" ? "線上付款" : a.paymentMode === "onsite" ? "現場付款" : "兩種皆可"}
                </Badge>
              </div>
              <div className="flex gap-1 pt-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(a)} className="flex-1">
                  <Pencil className="w-3 h-3 mr-1" />
                  編輯
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openSchedule(a.id)}
                  title="設定活動專屬時段"
                >
                  <Calendar className="w-3 h-3 mr-1" />
                  時段
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm(`停用「${a.name}」？玩家將無法看到此活動。`)) deleteMutation.mutate(a.id);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing || creating} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "編輯活動" : "新增活動"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="活動名稱 *">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例：賈村射擊體驗"
              />
            </Field>
            <Field label="Slug（URL 用、英數和 -）*" hint={`/book/<場域>/${form.slug || "shooting"}`}>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                placeholder="shooting"
                disabled={!!editing}
              />
            </Field>
            <Field label="封面圖 URL（Cloudinary）" hint="LINE 通知卡片 + 預約頁 hero 都會用">
              <Input
                value={form.coverUrl}
                onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
                placeholder="https://res.cloudinary.com/..."
              />
            </Field>
            <Field label="卡片簡介">
              <Input
                value={form.shortDesc}
                onChange={(e) => setForm({ ...form, shortDesc: e.target.value })}
                placeholder="一句話描述、列表顯示"
                maxLength={200}
              />
            </Field>
            <Field label="詳細說明">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="詳細頁顯示"
                rows={3}
              />
            </Field>
            <Field label="集合地點">
              <Input
                value={form.locationNote}
                onChange={(e) => setForm({ ...form, locationNote: e.target.value })}
                placeholder="例：賈村集合點、靶場入口"
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="單人價（元）*">
                <Input
                  type="number"
                  value={form.priceCents / 100}
                  onChange={(e) => setForm({ ...form, priceCents: Math.round(Number(e.target.value) * 100) })}
                />
              </Field>
              <Field label="時長（分鐘）*">
                <Input
                  type="number"
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                />
              </Field>
              <Field label="單梯人數 *">
                <Input
                  type="number"
                  value={form.capacityPerSlot}
                  onChange={(e) => setForm({ ...form, capacityPerSlot: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="付款模式 *" hint="目前僅支援『現場付款』；線上金流（Recur/Stripe/LinePay）待商戶帳號開通後啟用">
              <Select
                value={form.paymentMode}
                onValueChange={(v) => setForm({ ...form, paymentMode: v as ActivityForm["paymentMode"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onsite">現場付款（出示 QR 給工作人員）</SelectItem>
                  <SelectItem value="online" disabled>
                    線上付款（待金流開通）
                  </SelectItem>
                  <SelectItem value="both" disabled>
                    兩種皆可（待金流開通）
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {editing && (
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                <Label htmlFor="active">啟用</Label>
                <Switch
                  id="active"
                  checked={form.isActive}
                  onCheckedChange={(c) => setForm({ ...form, isActive: c })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name || !form.slug}>
              {saveMutation.isPending ? "儲存中…" : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="mt-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            活動時段
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          <p>點活動卡片的「時段」按鈕、為該活動設定獨立時段規則。</p>
          <p>未設活動時段 → 共用既有「預約管理 / 場域設定」頁的設定（向下相容）。</p>
        </CardContent>
      </Card>

      {/* 活動時段編輯 Dialog */}
      <Dialog open={!!schedulingActivityId} onOpenChange={(o) => !o && setSchedulingActivityId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              活動時段規則 — {data?.activities.find((a) => a.id === schedulingActivityId)?.name}
            </DialogTitle>
          </DialogHeader>
          {schedulingActivityId && (
            <ScheduleEditor
              template={scheduleDraft}
              onChange={setScheduleDraft}
              isSaving={scheduleMutation.isPending}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedulingActivityId(null)}>
              取消
            </Button>
            <Button
              onClick={() => scheduleMutation.mutate(scheduleDraft)}
              disabled={scheduleMutation.isPending}
            >
              {scheduleMutation.isPending ? "儲存中…" : "儲存時段"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UnifiedAdminLayout>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
