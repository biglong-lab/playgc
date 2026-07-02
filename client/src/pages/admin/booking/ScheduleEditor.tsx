// 預約時段規則編輯器 — Phase δ W1 D5
//
// UX 結構：
//   1. 規則列表（卡片式、按 priority 排序）
//   2. 「新增規則」button → RuleEditDialog
//   3. 月曆預覽（顯示每天哪條 rule 生效、容量）
//   4. 「預覽某日」彈窗（看具體 slots）
//
// 業主常見操作：
//   - 加平日規則（勾 [一][二][三][四][五]、設時段 / 金額 / 容量）
//   - 加假日規則（勾 [六][日]）
//   - 加暑假覆蓋（priority 50、日期區間 picker）
//   - 加生日休館（priority 100、日曆勾單日、空 slots）

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Calendar, Eye } from "lucide-react";
import type { BookingClosure } from "@shared/schema";
import ClosuresEditor from "./ClosuresEditor";

// ─ 型別（從 server schema 同步）─────────────────────────

interface SlotWindow {
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  capacity: number;
  gameDurationMinutes: number;
}
interface ApplyRange {
  weekdays?: number[];
  dateRanges?: Array<{ from: string; to: string }>;
  specificDates?: string[];
  treatHolidaysAsWeekend?: boolean;
}
export interface BookingRule {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  applyTo: ApplyRange;
  slots: SlotWindow[];
  pricePerSlotCentsOverride?: number;
  capacityOverride?: number;
  adminNotes?: string;
}
export interface ScheduleTemplate {
  rules: BookingRule[];
  blackoutDates?: string[];
  closures?: BookingClosure[];
  notes?: string;
  version?: number;
}

interface Props {
  template: ScheduleTemplate;
  onChange: (t: ScheduleTemplate) => void;
  isSaving?: boolean;
}

// ─ 主元件 ──────────────────────────────────────────────

export default function ScheduleEditor({ template, onChange, isSaving }: Props) {
  const [editingRule, setEditingRule] = useState<BookingRule | null>(null);
  const [previewDate, setPreviewDate] = useState<string | null>(null);

  const addRule = () => {
    const newRule: BookingRule = {
      id: `rule-${Date.now()}`,
      name: "新規則",
      priority: 0,
      enabled: true,
      applyTo: { weekdays: [1, 2, 3, 4, 5] },
      slots: [
        {
          startTime: "14:00",
          endTime: "18:00",
          intervalMinutes: 30,
          capacity: 12,
          gameDurationMinutes: 30,
        },
      ],
    };
    setEditingRule(newRule);
  };

  const saveRule = (rule: BookingRule) => {
    const existing = template.rules.findIndex((r) => r.id === rule.id);
    const newRules =
      existing >= 0
        ? template.rules.map((r) => (r.id === rule.id ? rule : r))
        : [...template.rules, rule];
    onChange({ ...template, rules: newRules });
    setEditingRule(null);
  };

  const deleteRule = (id: string) => {
    if (!window.confirm("確定要刪除此規則？")) return;
    onChange({ ...template, rules: template.rules.filter((r) => r.id !== id) });
  };

  const sortedRules = useMemo(
    () => [...template.rules].sort((a, b) => b.priority - a.priority),
    [template.rules],
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" data-testid="tab-rules">📋 規則列表</TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-calendar">📅 月曆預覽</TabsTrigger>
          <TabsTrigger value="blackouts" data-testid="tab-blackout-dates">🚫 休假/包場</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              規則按 priority 排序、同日多條 match 取 priority 最高
            </p>
            <Button size="sm" onClick={addRule} data-testid="button-add-rule">
              <Plus className="w-4 h-4 mr-1" /> 新增規則
            </Button>
          </div>
          {sortedRules.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              尚無規則、點上方按鈕新增
            </p>
          ) : (
            <div className="space-y-2">
              {sortedRules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={() => setEditingRule(rule)}
                  onDelete={() => deleteRule(rule.id)}
                  onToggle={(enabled) =>
                    onChange({
                      ...template,
                      rules: template.rules.map((r) =>
                        r.id === rule.id ? { ...r, enabled } : r,
                      ),
                    })
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarPreview
            template={template}
            onPickDate={setPreviewDate}
          />
        </TabsContent>

        <TabsContent value="blackouts">
          <BlackoutDatesEditor
            blackoutDates={template.blackoutDates ?? []}
            onChange={(dates) => onChange({ ...template, blackoutDates: dates })}
          />
        </TabsContent>
      </Tabs>

      {/* 編輯規則 Dialog */}
      {editingRule && (
        <RuleEditDialog
          rule={editingRule}
          onCancel={() => setEditingRule(null)}
          onSave={saveRule}
        />
      )}

      {/* 預覽某日 Dialog */}
      {previewDate && (
        <DayPreviewDialog
          date={previewDate}
          template={template}
          onClose={() => setPreviewDate(null)}
        />
      )}

      {isSaving && (
        <p className="text-xs text-muted-foreground text-right">儲存中...</p>
      )}
    </div>
  );
}

// ─ RuleCard ────────────────────────────────────────────

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: BookingRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
}) {
  const summary = describeRule(rule);
  return (
    <Card className={!rule.enabled ? "opacity-50" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium" data-testid={`rule-name-${rule.id}`}>{rule.name}</span>
            {rule.priority > 0 && (
              <Badge variant="outline" className="text-xs">
                priority {rule.priority}
              </Badge>
            )}
            {rule.slots.length === 0 && (
              <Badge variant="destructive" className="text-xs">休館</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{summary}</p>
        </div>
        <Switch
          checked={rule.enabled}
          onCheckedChange={onToggle}
          data-testid={`switch-rule-${rule.id}`}
        />
        <Button size="sm" variant="ghost" onClick={onEdit} data-testid={`button-edit-${rule.id}`}>
          <Edit2 className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      </CardContent>
    </Card>
  );
}

function describeRule(rule: BookingRule): string {
  const parts: string[] = [];
  const wd = rule.applyTo.weekdays;
  if (wd && wd.length > 0) {
    if (wd.length === 5 && [1, 2, 3, 4, 5].every((d) => wd.includes(d))) {
      parts.push("一到五");
    } else if (wd.length === 2 && wd.includes(0) && wd.includes(6)) {
      parts.push("六日");
    } else {
      parts.push(wd.map((d) => "日一二三四五六"[d]).join(""));
    }
  }
  if (rule.applyTo.dateRanges && rule.applyTo.dateRanges.length > 0) {
    parts.push(
      `區間 ${rule.applyTo.dateRanges
        .map((r) => `${r.from}→${r.to}`)
        .join(" / ")}`,
    );
  }
  if (rule.applyTo.specificDates && rule.applyTo.specificDates.length > 0) {
    parts.push(`${rule.applyTo.specificDates.length} 個特定日`);
  }
  if (rule.slots.length === 0) {
    parts.push("(休館)");
  } else {
    const s = rule.slots[0];
    parts.push(`${s.startTime}-${s.endTime} 每${s.intervalMinutes}分一梯 ${s.capacity}人`);
  }
  if (rule.pricePerSlotCentsOverride !== undefined) {
    parts.push(`NT$${Math.round(rule.pricePerSlotCentsOverride / 100)}`);
  }
  return parts.join(" · ");
}

// ─ RuleEditDialog ──────────────────────────────────────

function RuleEditDialog({
  rule,
  onCancel,
  onSave,
}: {
  rule: BookingRule;
  onCancel: () => void;
  onSave: (r: BookingRule) => void;
}) {
  const [draft, setDraft] = useState<BookingRule>(rule);
  const slot = draft.slots[0] ?? {
    startTime: "10:00",
    endTime: "18:00",
    intervalMinutes: 30,
    capacity: 12,
    gameDurationMinutes: 30,
  };

  const toggleWeekday = (d: number) => {
    const cur = draft.applyTo.weekdays ?? [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    setDraft({ ...draft, applyTo: { ...draft.applyTo, weekdays: next.sort() } });
  };

  const updateSlot = (patch: Partial<SlotWindow>) => {
    const newSlot = { ...slot, ...patch };
    setDraft({ ...draft, slots: [newSlot] });
  };

  const addDateRange = () => {
    const today = new Date().toISOString().slice(0, 10);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const next = nextMonth.toISOString().slice(0, 10);
    setDraft({
      ...draft,
      applyTo: {
        ...draft.applyTo,
        dateRanges: [...(draft.applyTo.dateRanges ?? []), { from: today, to: next }],
      },
    });
  };

  const removeDateRange = (i: number) => {
    setDraft({
      ...draft,
      applyTo: {
        ...draft.applyTo,
        dateRanges: (draft.applyTo.dateRanges ?? []).filter((_, idx) => idx !== i),
      },
    });
  };

  const updateDateRange = (i: number, patch: { from?: string; to?: string }) => {
    setDraft({
      ...draft,
      applyTo: {
        ...draft.applyTo,
        dateRanges: (draft.applyTo.dateRanges ?? []).map((r, idx) =>
          idx === i ? { ...r, ...patch } : r,
        ),
      },
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯規則</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>名稱</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              data-testid="input-rule-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>優先級</Label>
              <Input
                type="number"
                value={draft.priority}
                onChange={(e) =>
                  setDraft({ ...draft, priority: parseInt(e.target.value, 10) || 0 })
                }
                data-testid="input-rule-priority"
              />
              <p className="text-xs text-muted-foreground mt-1">
                0=預設、50=覆蓋、100=特殊（休館）
              </p>
            </div>
            <div className="flex items-end gap-2">
              <Switch
                checked={draft.enabled}
                onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
              />
              <Label className="mb-2">啟用此規則</Label>
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="block mb-2">適用週天</Label>
            <div className="flex gap-1">
              {["日", "一", "二", "三", "四", "五", "六"].map((label, idx) => {
                const active = (draft.applyTo.weekdays ?? []).includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleWeekday(idx)}
                    className={`w-10 h-10 rounded-lg border text-sm font-bold ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border"
                    }`}
                    data-testid={`weekday-${idx}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2 text-xs">
              <button
                type="button"
                className="text-primary underline"
                onClick={() =>
                  setDraft({ ...draft, applyTo: { ...draft.applyTo, weekdays: [1, 2, 3, 4, 5] } })
                }
              >
                平日（一到五）
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                className="text-primary underline"
                onClick={() =>
                  setDraft({ ...draft, applyTo: { ...draft.applyTo, weekdays: [0, 6] } })
                }
              >
                假日（六日）
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                className="text-primary underline"
                onClick={() =>
                  setDraft({ ...draft, applyTo: { ...draft.applyTo, weekdays: [0, 1, 2, 3, 4, 5, 6] } })
                }
              >
                全週
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Switch
                checked={draft.applyTo.treatHolidaysAsWeekend ?? false}
                onCheckedChange={(v) =>
                  setDraft({
                    ...draft,
                    applyTo: { ...draft.applyTo, treatHolidaysAsWeekend: v },
                  })
                }
              />
              <Label className="text-xs">國定假日視為週末</Label>
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label>適用日期區間</Label>
              <Button size="sm" variant="outline" onClick={addDateRange}>
                <Plus className="w-3 h-3 mr-1" /> 加區間
              </Button>
            </div>
            {(draft.applyTo.dateRanges ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">無 — 全週天皆套用</p>
            ) : (
              <div className="space-y-2">
                {(draft.applyTo.dateRanges ?? []).map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={r.from}
                      onChange={(e) => updateDateRange(i, { from: e.target.value })}
                      className="w-40"
                    />
                    <span>→</span>
                    <Input
                      type="date"
                      value={r.to}
                      onChange={(e) => updateDateRange(i, { to: e.target.value })}
                      className="w-40"
                    />
                    <Button size="sm" variant="ghost" onClick={() => removeDateRange(i)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <Label className="mb-2 block">時段（slot window）</Label>
            <p className="text-xs text-muted-foreground mb-2">
              留空 = 此規則「休館」（priority 100 + 空 slots = 整天關閉）
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">開始時間</Label>
                <Input
                  type="time"
                  value={slot.startTime}
                  onChange={(e) => updateSlot({ startTime: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">結束時間</Label>
                <Input
                  type="time"
                  value={slot.endTime}
                  onChange={(e) => updateSlot({ endTime: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">每幾分鐘一梯</Label>
                <Input
                  type="number"
                  value={slot.intervalMinutes}
                  onChange={(e) =>
                    updateSlot({ intervalMinutes: parseInt(e.target.value, 10) || 30 })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">遊戲時長（分）</Label>
                <Input
                  type="number"
                  value={slot.gameDurationMinutes}
                  onChange={(e) =>
                    updateSlot({
                      gameDurationMinutes: parseInt(e.target.value, 10) || 30,
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">每梯人數</Label>
                <Input
                  type="number"
                  value={slot.capacity}
                  onChange={(e) =>
                    updateSlot({ capacity: parseInt(e.target.value, 10) || 12 })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">每梯費用（元、空 = 用全域預設）</Label>
                <Input
                  type="number"
                  value={
                    draft.pricePerSlotCentsOverride !== undefined
                      ? Math.round(draft.pricePerSlotCentsOverride / 100)
                      : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft({
                      ...draft,
                      pricePerSlotCentsOverride:
                        v === "" ? undefined : Math.max(0, parseInt(v, 10) || 0) * 100,
                    });
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDraft({ ...draft, slots: [] })}
              >
                清空時段（休館）
              </Button>
            </div>
          </div>

          <div>
            <Label>備註（私人）</Label>
            <Textarea
              value={draft.adminNotes ?? ""}
              onChange={(e) => setDraft({ ...draft, adminNotes: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={() => onSave(draft)} data-testid="button-save-rule">儲存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─ CalendarPreview ─────────────────────────────────────

function CalendarPreview({
  template,
  onPickDate,
}: {
  template: ScheduleTemplate;
  onPickDate: (ymd: string) => void;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ ymd: string; dayNum: number; ruleName: string | null }> = [];
    for (let i = 0; i < startDay; i++) cells.push({ ymd: "", dayNum: 0, ruleName: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const ymd = formatYMD(date);
      const rule = resolveRule(template, date);
      cells.push({
        ymd,
        dayNum: d,
        ruleName: rule ? (rule.slots.length === 0 ? "休館" : rule.name) : null,
      });
    }
    return cells;
  }, [year, month, template]);

  const monthLabel = `${year} 年 ${month + 1} 月`;

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (month === 0) {
                setMonth(11);
                setYear(year - 1);
              } else setMonth(month - 1);
            }}
          >
            ← 上月
          </Button>
          <h3 className="font-bold">{monthLabel}</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (month === 11) {
                setMonth(0);
                setYear(year + 1);
              } else setMonth(month + 1);
            }}
          >
            下月 →
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
            <div key={d} className="text-center text-xs text-muted-foreground py-1">
              {d}
            </div>
          ))}
          {days.map((cell, i) => {
            if (!cell.ymd)
              return <div key={`empty-${i}`} className="aspect-square" />;
            const isClosed = cell.ruleName === "休館" || cell.ruleName === null;
            return (
              <button
                key={cell.ymd}
                type="button"
                onClick={() => onPickDate(cell.ymd)}
                className={`aspect-square p-1 rounded text-xs flex flex-col items-center justify-center hover:ring-2 hover:ring-primary ${
                  isClosed
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 text-foreground"
                }`}
                data-testid={`calendar-day-${cell.ymd}`}
              >
                <span className="font-bold">{cell.dayNum}</span>
                <span className="text-[9px] truncate w-full text-center opacity-70">
                  {cell.ruleName || "—"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          淺色 = 開放、灰色 = 休館 / 無規則 — 點按看當日 slot 詳情
        </p>
      </CardContent>
    </Card>
  );
}

// ─ DayPreviewDialog ────────────────────────────────────

function DayPreviewDialog({
  date,
  template,
  onClose,
}: {
  date: string;
  template: ScheduleTemplate;
  onClose: () => void;
}) {
  const [y, m, d] = date.split("-").map((s) => parseInt(s, 10));
  const dt = new Date(y, m - 1, d);
  const rule = resolveRule(template, dt);
  const slots = rule ? expandSlots(dt, rule) : [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {date}（
            {["日", "一", "二", "三", "四", "五", "六"][dt.getDay()]}）
          </DialogTitle>
        </DialogHeader>
        <div>
          {!rule ? (
            <p className="text-muted-foreground">此日無規則 match — 完全關閉</p>
          ) : rule.slots.length === 0 ? (
            <p className="text-destructive">休館（rule: {rule.name}）</p>
          ) : (
            <div>
              <p className="text-sm mb-2">
                <strong>規則：</strong>
                {rule.name}{" "}
                {rule.priority > 0 && (
                  <Badge variant="outline" className="text-xs">
                    p{rule.priority}
                  </Badge>
                )}
              </p>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                {slots.map((s, i) => (
                  <div
                    key={i}
                    className="bg-muted px-2 py-1 rounded text-center text-xs"
                  >
                    {formatTime(s.start)} - {formatTime(s.end)}
                    <div className="text-[10px] text-muted-foreground">
                      容量 {s.capacity}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                共 {slots.length} 梯次 · 總容量 {slots.reduce((a, x) => a + x.capacity, 0)}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─ BlackoutDatesEditor ─────────────────────────────────

function BlackoutDatesEditor({
  blackoutDates,
  onChange,
}: {
  blackoutDates: string[];
  onChange: (dates: string[]) => void;
}) {
  const [newDate, setNewDate] = useState("");
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          特定日期完全關閉（最高優先、覆蓋所有規則）
        </p>
        <div className="flex gap-2">
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            data-testid="input-blackout-date"
          />
          <Button
            onClick={() => {
              if (newDate && !blackoutDates.includes(newDate)) {
                onChange([...blackoutDates, newDate].sort());
                setNewDate("");
              }
            }}
            disabled={!newDate}
          >
            <Plus className="w-3 h-3 mr-1" /> 加入
          </Button>
        </div>
        {blackoutDates.length === 0 ? (
          <p className="text-muted-foreground text-sm py-3 text-center">尚無休假日</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {blackoutDates.map((d) => (
              <Badge
                key={d}
                variant="outline"
                className="cursor-pointer"
                onClick={() => onChange(blackoutDates.filter((x) => x !== d))}
              >
                {d} ✕
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          點 Badge 可移除。例：聖誕、店主婚禮、設備大保養
        </p>
      </CardContent>
    </Card>
  );
}

// ─ Helper：本地端 rule resolver（同 server）──────────────

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isInRange(ymd: string, range: { from: string; to: string }): boolean {
  return ymd >= range.from && ymd <= range.to;
}

function matchesApply(date: Date, applyTo: ApplyRange): boolean {
  const ymd = formatYMD(date);
  if (applyTo.specificDates?.includes(ymd)) return true;
  if (applyTo.dateRanges?.some((r) => isInRange(ymd, r))) return true;
  if (applyTo.weekdays && applyTo.weekdays.length > 0) {
    if (applyTo.weekdays.includes(date.getDay())) return true;
  }
  return false;
}

function resolveRule(t: ScheduleTemplate, date: Date): BookingRule | null {
  const ymd = formatYMD(date);
  if (t.blackoutDates?.includes(ymd)) {
    return { id: "blackout", name: "休館", priority: 999, enabled: true, applyTo: {}, slots: [] };
  }
  const matched = t.rules.filter((r) => r.enabled && matchesApply(date, r.applyTo));
  if (matched.length === 0) return null;
  return [...matched].sort((a, b) => b.priority - a.priority)[0]!;
}

interface ExpandedSlot {
  start: Date;
  end: Date;
  capacity: number;
}

function expandSlots(date: Date, rule: BookingRule): ExpandedSlot[] {
  const result: ExpandedSlot[] = [];
  for (const w of rule.slots) {
    const [sH, sM] = w.startTime.split(":").map((s) => parseInt(s, 10));
    const [eH, eM] = w.endTime.split(":").map((s) => parseInt(s, 10));
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sH, sM);
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eH, eM);
    let cur = new Date(start);
    while (true) {
      const slotEnd = new Date(cur.getTime() + w.gameDurationMinutes * 60_000);
      if (slotEnd > end) break;
      result.push({
        start: new Date(cur),
        end: slotEnd,
        capacity: rule.capacityOverride ?? w.capacity,
      });
      cur = new Date(cur.getTime() + w.intervalMinutes * 60_000);
    }
  }
  return result;
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
