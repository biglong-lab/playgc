// 時段關閉 / 包場活動 編輯器（2026-07-02）
// 取代舊「休假日」純日期清單：支援整日 / 單一時段關閉、事由分類、原因必填、顯示設定人。
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { BookingClosure, BookingClosureType } from "@shared/schema";

const TYPE_OPTIONS: { value: BookingClosureType; label: string; className: string }[] = [
  { value: "holiday", label: "休假日", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  { value: "private_booking", label: "包場", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  { value: "maintenance", label: "設備保養", className: "bg-gray-500/15 text-gray-500 border-gray-500/30" },
  { value: "event", label: "活動", className: "bg-purple-500/15 text-purple-600 border-purple-500/30" },
  { value: "other", label: "其他", className: "bg-slate-500/15 text-slate-500 border-slate-500/30" },
];

function typeMeta(t: BookingClosureType) {
  return TYPE_OPTIONS.find((o) => o.value === t) ?? TYPE_OPTIONS[4];
}

function genId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* noop */ }
  return `c-${Date.now()}-${Math.floor(performance.now())}`;
}

interface Props {
  closures: BookingClosure[];
  legacyBlackoutDates: string[];
  onChangeClosures: (closures: BookingClosure[]) => void;
  onChangeBlackoutDates: (dates: string[]) => void;
}

export default function ClosuresEditor({
  closures,
  legacyBlackoutDates,
  onChangeClosures,
  onChangeBlackoutDates,
}: Props) {
  const [date, setDate] = useState("");
  const [scope, setScope] = useState<"full_day" | "time_range">("full_day");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("17:00");
  const [type, setType] = useState<BookingClosureType>("private_booking");
  const [reason, setReason] = useState("");

  const timeInvalid = scope === "time_range" && (!startTime || !endTime || startTime >= endTime);
  const canAdd = !!date && !!reason.trim() && !timeInvalid;

  const add = () => {
    if (!canAdd) return;
    const next: BookingClosure = {
      id: genId(),
      date,
      scope,
      type,
      reason: reason.trim(),
      ...(scope === "time_range" ? { startTime, endTime } : {}),
    };
    onChangeClosures([...closures, next]);
    setReason("");
  };

  const remove = (id: string) => onChangeClosures(closures.filter((c) => c.id !== id));

  // 依日期 + 時段排序顯示
  const sorted = [...closures].sort((a, b) =>
    a.date === b.date ? (a.startTime ?? "").localeCompare(b.startTime ?? "") : a.date.localeCompare(b.date),
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* 新增表單 */}
        <div className="space-y-3">
          <p className="text-sm font-medium">新增關閉 / 包場</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">日期 *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-closure-date" />
            </div>
            <div>
              <Label className="text-xs">類型</Label>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as BookingClosureType)}
                data-testid="select-closure-type"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={scope === "full_day"} onChange={() => setScope("full_day")} data-testid="radio-scope-fullday" />
              整日關閉
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={scope === "time_range"} onChange={() => setScope("time_range")} data-testid="radio-scope-timerange" />
              指定時段
            </label>
          </div>

          {scope === "time_range" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">開始</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="input-closure-start" />
              </div>
              <div>
                <Label className="text-xs">結束</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="input-closure-end" />
              </div>
            </div>
          )}
          {timeInvalid && <p className="text-xs text-destructive">結束時間需晚於開始時間</p>}

          <div>
            <Label className="text-xs">原因備註 *（必填）</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例：水彈包場、設備大保養、店主婚禮"
              maxLength={500}
              data-testid="input-closure-reason"
            />
          </div>

          <Button onClick={add} disabled={!canAdd} className="w-full" data-testid="btn-add-closure">
            <Plus className="w-4 h-4 mr-1" /> 加入
          </Button>
        </div>

        {/* 清單 */}
        <div className="space-y-2">
          <p className="text-sm font-medium">已設定（{sorted.length + legacyBlackoutDates.length}）</p>
          {sorted.length === 0 && legacyBlackoutDates.length === 0 && (
            <p className="text-muted-foreground text-sm py-2 text-center">尚無關閉設定</p>
          )}
          {sorted.map((c) => {
            const meta = typeMeta(c.type);
            return (
              <div key={c.id} className="flex items-start justify-between gap-2 border rounded-md p-2" data-testid={`closure-item-${c.id}`}>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium tabular-nums">{c.date}</span>
                    <Badge variant="outline" className={`text-[10px] ${meta.className}`}>{meta.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {c.scope === "full_day" ? "整日" : `${c.startTime}–${c.endTime}`}
                    </span>
                  </div>
                  <p className="text-sm break-words">{c.reason}</p>
                  {c.createdByName && (
                    <p className="text-[11px] text-muted-foreground">
                      設定：{c.createdByName}
                      {c.createdAt ? ` · ${new Date(c.createdAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => remove(c.id)} data-testid={`btn-remove-closure-${c.id}`}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            );
          })}

          {/* 舊 blackoutDates（相容顯示、可移除）*/}
          {legacyBlackoutDates.map((d) => (
            <div key={`legacy-${d}`} className="flex items-center justify-between gap-2 border border-dashed rounded-md p-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm tabular-nums">{d}</span>
                <Badge variant="outline" className="text-[10px]">整日關閉（舊）</Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={() => onChangeBlackoutDates(legacyBlackoutDates.filter((x) => x !== d))}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          整日或單一時段皆可關閉；原因必填。儲存後系統會記錄設定帳號與時間。
        </p>
      </CardContent>
    </Card>
  );
}
