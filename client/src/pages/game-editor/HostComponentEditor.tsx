// 🎪 活動元件（host_*）設定編輯器 — Schema 驅動（2026-08-06, CHITO c609d0c3）
//
// 背景：17 個活動元件在 PageConfigEditor 全部掉進 default 分支 =
// 唯讀 JSON 傾印，管理員無法設定任何題目/選項/獎項（「活動元件設定
// 都處於半成品」的實體）。
//
// 設計：不寫 17 個手刻編輯器，改一份「每型別欄位定義表」＋通用表單
// 產生器。之後新增活動元件只要在 HOST_FIELD_SCHEMAS 加一段定義。
// 欄位種類：text / textarea / number / boolean / string-list / object-list
// （object-list 支援 toRow/fromRow 讓底層形狀與表格欄位互轉，如搶答題）。

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

// ── 欄位定義型別 ─────────────────────────────────
interface ColumnDef {
  key: string;
  label: string;
  type: "text" | "number";
  /** 欄寬 class（預設 flex-1）*/
  width?: string;
  placeholder?: string;
}

type FieldDef =
  | { kind: "text"; key: string; label: string; placeholder?: string }
  | { kind: "textarea"; key: string; label: string; placeholder?: string }
  | { kind: "number"; key: string; label: string; min?: number; max?: number; hint?: string }
  | { kind: "boolean"; key: string; label: string; hint?: string }
  | { kind: "string-list"; key: string; label: string; itemLabel: string; hint?: string }
  | {
      kind: "object-list";
      key: string;
      label: string;
      itemLabel: string;
      columns: ColumnDef[];
      /** 底層物件 → 表格列（預設 identity）*/
      toRow?: (item: Record<string, unknown>) => Record<string, unknown>;
      /** 表格列 → 底層物件（預設 identity；idx 供產 id）*/
      fromRow?: (row: Record<string, unknown>, idx: number) => Record<string, unknown>;
      /** 新增一筆時的預設列 */
      newRow: (idx: number) => Record<string, unknown>;
      hint?: string;
    };

// ── 搶答題：底層 {id,prompt,options[4],correctIdx,timeLimitSec} ↔ 表格列 ──
const triviaToRow = (q: Record<string, unknown>) => {
  const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
  return {
    prompt: q.prompt ?? "",
    opt1: opts[0] ?? "", opt2: opts[1] ?? "", opt3: opts[2] ?? "", opt4: opts[3] ?? "",
    correct: typeof q.correctIdx === "number" ? q.correctIdx + 1 : 1,
    timeLimitSec: q.timeLimitSec ?? 15,
  };
};
const triviaFromRow = (r: Record<string, unknown>, idx: number) => ({
  id: `q${idx + 1}`,
  prompt: String(r.prompt ?? ""),
  options: [r.opt1, r.opt2, r.opt3, r.opt4].map((o) => String(o ?? "")),
  correctIdx: Math.min(3, Math.max(0, Number(r.correct ?? 1) - 1)),
  timeLimitSec: Math.max(5, Number(r.timeLimitSec ?? 15)),
});

// ── 每型別欄位定義（來源：getDefaultConfig + 各元件 config 介面）──
export const HOST_FIELD_SCHEMAS: Record<string, FieldDef[]> = {
  host_word_cloud: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "text", key: "subtitle", label: "副標（顯示在標題下）" },
    { kind: "text", key: "prompt", label: "輸入框提示文字" },
    { kind: "number", key: "maxWordsPerUser", label: "每人可送詞數", min: 1, max: 20 },
    { kind: "number", key: "maxLength", label: "單詞字數上限", min: 1, max: 30 },
  ],
  host_poll_live: [
    { kind: "text", key: "question", label: "投票題目" },
    {
      kind: "object-list", key: "options", label: "選項", itemLabel: "選項",
      columns: [{ key: "label", label: "選項文字", type: "text" }],
      newRow: (i) => ({ id: `opt-${i + 1}`, label: `選項 ${i + 1}` }),
    },
  ],
  host_emoji_react: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "text", key: "subtitle", label: "副標" },
    { kind: "string-list", key: "emojis", label: "可用 Emoji", itemLabel: "emoji" },
    { kind: "number", key: "maxFlyingOnScreen", label: "螢幕同時飛行上限", min: 10, max: 200 },
  ],
  host_wave_response: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "text", key: "buttonLabel", label: "按鈕文字" },
  ],
  host_crowd_gather: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "number", key: "targetCount", label: "目標人數", min: 1 },
    { kind: "text", key: "celebrationText", label: "達標慶祝文字" },
  ],
  host_trivia_showdown: [
    { kind: "text", key: "title", label: "標題" },
    {
      kind: "object-list", key: "questions", label: "題庫", itemLabel: "題目",
      columns: [
        { key: "prompt", label: "題目", type: "text", width: "flex-[2]" },
        { key: "opt1", label: "選項1", type: "text" },
        { key: "opt2", label: "選項2", type: "text" },
        { key: "opt3", label: "選項3", type: "text" },
        { key: "opt4", label: "選項4", type: "text" },
        { key: "correct", label: "正解(1-4)", type: "number", width: "w-20" },
        { key: "timeLimitSec", label: "秒數", type: "number", width: "w-20" },
      ],
      toRow: triviaToRow,
      fromRow: triviaFromRow,
      newRow: (i) => ({
        prompt: "", opt1: "", opt2: "", opt3: "", opt4: "", correct: 1, timeLimitSec: 15,
        _idx: i,
      }),
      hint: "正解填 1-4（對應選項1-4）",
    },
  ],
  host_live_leaderboard: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "number", key: "topN", label: "顯示前 N 名", min: 3, max: 50 },
  ],
  host_team_battle_score: [
    { kind: "text", key: "title", label: "標題" },
    {
      kind: "object-list", key: "teams", label: "隊伍", itemLabel: "隊伍",
      columns: [
        { key: "name", label: "隊名", type: "text" },
        { key: "score", label: "初始分數", type: "number", width: "w-24" },
      ],
      newRow: (i) => ({ id: `team-${i + 1}`, name: `隊伍 ${i + 1}`, score: 0 }),
    },
  ],
  host_progress_quest: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "number", key: "totalTasks", label: "任務總數", min: 1 },
  ],
  host_polaroid_collage: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "number", key: "maxOnScreen", label: "牆上同時顯示上限", min: 10, max: 200 },
    { kind: "string-list", key: "emojis", label: "裝飾 Emoji", itemLabel: "emoji" },
  ],
  host_guestbook_digital: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "number", key: "maxEntries", label: "簽名上限", min: 10, max: 1000 },
  ],
  host_blessing_wall: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "text", key: "subtitle", label: "副標" },
    { kind: "number", key: "maxLength", label: "祝福字數上限", min: 10, max: 200 },
    { kind: "string-list", key: "emojis", label: "裝飾 Emoji", itemLabel: "emoji" },
  ],
  host_knowledge_map: [
    { kind: "text", key: "title", label: "標題" },
    {
      kind: "object-list", key: "points", label: "地點", itemLabel: "地點",
      columns: [
        { key: "name", label: "地點名", type: "text" },
        { key: "hint", label: "提示", type: "text", width: "flex-[2]" },
      ],
      newRow: (i) => ({ id: `p${i + 1}`, name: "", hint: "" }),
    },
    { kind: "boolean", key: "allowMessage", label: "允許玩家留言" },
  ],
  host_scoreboard_announcement: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "number", key: "displayDurationMs", label: "單則顯示毫秒", min: 2000, max: 30000 },
  ],
  host_lottery_wheel: [
    { kind: "text", key: "title", label: "標題" },
    {
      kind: "object-list", key: "items", label: "獎項", itemLabel: "獎項",
      columns: [{ key: "label", label: "獎項名稱", type: "text" }],
      newRow: (i) => ({ id: `item-${i + 1}`, label: "" }),
    },
    { kind: "number", key: "spinDurationMs", label: "轉盤動畫毫秒", min: 1000, max: 15000 },
    { kind: "boolean", key: "allowJoin", label: "允許玩家掃碼加入抽獎池" },
  ],
  host_bingo_board: [
    { kind: "text", key: "title", label: "標題" },
    {
      kind: "object-list", key: "tasks", label: "格子任務（5×5=25 格、第 13 格建議設為自由格）",
      itemLabel: "格子",
      columns: [{ key: "label", label: "任務文字", type: "text" }],
      newRow: (i) => ({ id: `task-${i + 1}`, label: "" }),
    },
  ],
  host_micro_qa: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "number", key: "maxLength", label: "提問字數上限", min: 20, max: 500 },
    { kind: "boolean", key: "allowAnonymous", label: "允許匿名提問" },
  ],
};

// ── 通用渲染 ─────────────────────────────────────
interface Props {
  pageType: string;
  config: Record<string, unknown>;
  /** 與其他 editor 一致的單欄更新 */
  updateField: (key: string, value: unknown) => void;
}

export default function HostComponentEditor({ pageType, config, updateField }: Props) {
  const schema = HOST_FIELD_SCHEMAS[pageType];
  if (!schema) return null;

  return (
    <div className="space-y-4" data-testid={`host-editor-${pageType}`}>
      <p className="text-xs text-muted-foreground">
        📺 活動元件設定 — 存檔後大螢幕與玩家端即用新設定開場
      </p>
      {schema.map((field) => (
        <FieldRenderer key={field.key} field={field} config={config} updateField={updateField} />
      ))}
    </div>
  );
}

function FieldRenderer({
  field, config, updateField,
}: { field: FieldDef; config: Record<string, unknown>; updateField: (k: string, v: unknown) => void }) {
  const value = config[field.key];

  switch (field.kind) {
    case "text":
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Input
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(e) => updateField(field.key, e.target.value)}
            data-testid={`host-field-${field.key}`}
          />
        </div>
      );
    case "textarea":
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Textarea
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(e) => updateField(field.key, e.target.value)}
            data-testid={`host-field-${field.key}`}
          />
        </div>
      );
    case "number":
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Input
            type="number"
            value={value === undefined || value === null ? "" : Number(value)}
            min={field.min}
            max={field.max}
            onChange={(e) => {
              const n = e.target.value === "" ? undefined : Number(e.target.value);
              updateField(field.key, n);
            }}
            data-testid={`host-field-${field.key}`}
          />
          {field.hint && <p className="text-[10px] text-muted-foreground">{field.hint}</p>}
        </div>
      );
    case "boolean":
      return (
        <div className="flex items-center justify-between py-1">
          <Label className="text-xs">{field.label}</Label>
          <Switch
            checked={Boolean(value)}
            onCheckedChange={(v) => updateField(field.key, v)}
            data-testid={`host-field-${field.key}`}
          />
        </div>
      );
    case "string-list": {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <div className="flex flex-wrap gap-2">
            {list.map((item, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  value={item}
                  className="w-20 text-center"
                  onChange={(e) => {
                    const next = [...list];
                    next[i] = e.target.value;
                    updateField(field.key, next);
                  }}
                  data-testid={`host-field-${field.key}-${i}`}
                />
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => updateField(field.key, list.filter((_, j) => j !== i))}
                  aria-label={`刪除${field.itemLabel}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline" size="sm"
              onClick={() => updateField(field.key, [...list, ""])}
              data-testid={`host-field-${field.key}-add`}
            >
              <Plus className="w-3 h-3 mr-1" />新增{field.itemLabel}
            </Button>
          </div>
        </div>
      );
    }
    case "object-list": {
      const raw = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const toRow = field.toRow ?? ((x: Record<string, unknown>) => x);
      const fromRow = field.fromRow ?? ((x: Record<string, unknown>) => x);
      const rows = raw.map(toRow);

      const commit = (nextRows: Record<string, unknown>[]) => {
        updateField(field.key, nextRows.map((r, i) => fromRow(r, i)));
      };

      return (
        <div className="space-y-2">
          <Label className="text-xs">{field.label}（{rows.length}）</Label>
          {field.hint && <p className="text-[10px] text-muted-foreground">{field.hint}</p>}
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-end gap-1.5 bg-accent/20 rounded-lg p-2">
                <span className="text-[10px] text-muted-foreground w-5 pb-2">{i + 1}</span>
                {field.columns.map((col) => (
                  <div key={col.key} className={`space-y-0.5 ${col.width ?? "flex-1"}`}>
                    <Label className="text-[10px] text-muted-foreground">{col.label}</Label>
                    <Input
                      type={col.type === "number" ? "number" : "text"}
                      value={
                        col.type === "number"
                          ? Number(row[col.key] ?? 0)
                          : String(row[col.key] ?? "")
                      }
                      placeholder={col.placeholder}
                      className="h-8 text-xs"
                      onChange={(e) => {
                        const next = rows.map((r, j) =>
                          j === i
                            ? { ...r, [col.key]: col.type === "number" ? Number(e.target.value) : e.target.value }
                            : r,
                        );
                        commit(next);
                      }}
                      data-testid={`host-field-${field.key}-${i}-${col.key}`}
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-0.5 pb-0.5">
                  <Button
                    variant="ghost" size="icon" className="h-5 w-5" disabled={i === 0}
                    onClick={() => {
                      const next = [...rows];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      commit(next);
                    }}
                    aria-label="上移"
                  ><ArrowUp className="w-3 h-3" /></Button>
                  <Button
                    variant="ghost" size="icon" className="h-5 w-5" disabled={i === rows.length - 1}
                    onClick={() => {
                      const next = [...rows];
                      [next[i], next[i + 1]] = [next[i + 1], next[i]];
                      commit(next);
                    }}
                    aria-label="下移"
                  ><ArrowDown className="w-3 h-3" /></Button>
                </div>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 pb-0.5"
                  onClick={() => commit(rows.filter((_, j) => j !== i))}
                  aria-label={`刪除${field.itemLabel}`}
                ><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => commit([...rows, field.newRow(rows.length)])}
            data-testid={`host-field-${field.key}-add`}
          >
            <Plus className="w-3 h-3 mr-1" />新增{field.itemLabel}
          </Button>
        </div>
      );
    }
  }
}
