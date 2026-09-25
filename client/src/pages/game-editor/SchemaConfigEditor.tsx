// 🧩 Schema 驅動的元件設定編輯器（2026-08-06, CHITO c609d0c3；2026-09-25 改名）
//
// 背景：互動模組庫的元件在 PageConfigEditor 原本全部掉進 default 分支 =
// 唯讀 JSON 傾印，管理員無法設定任何題目/選項。
//
// 設計：不逐一手刻編輯器，改一份「每型別欄位定義表」（eventModuleSchemas.ts）
// ＋這裡的通用表單產生器。之後新增可設定元件只要在 EVENT_MODULE_SCHEMAS 加一段定義。
// 欄位種類：text / textarea / number / boolean / string-list / object-list
// （object-list 支援 toRow/fromRow 讓底層形狀與表格欄位互轉）。
//
// 沿革：原本同時承載 17 個大螢幕（📺）元件的 schema；大螢幕互動已整條移交
// PhotoGo（ADR-0029），那批 schema 一併移除、檔案改為中性命名。

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { EVENT_MODULE_SCHEMAS } from "./eventModuleSchemas";

// ── 欄位定義型別 ─────────────────────────────────
interface ColumnDef {
  key: string;
  label: string;
  type: "text" | "number";
  /** 欄寬 class（預設 flex-1）*/
  width?: string;
  placeholder?: string;
}

export type FieldDef =
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

// ── 通用渲染 ─────────────────────────────────────
interface Props {
  pageType: string;
  config: Record<string, unknown>;
  /** 與其他 editor 一致的單欄更新 */
  updateField: (key: string, value: unknown) => void;
}

/** 此 pageType 是否有 schema 驅動的設定表單（沒有就交給呼叫端顯示 JSON） */
export function hasSchemaConfigEditor(pageType: string): boolean {
  return pageType in EVENT_MODULE_SCHEMAS;
}

export default function SchemaConfigEditor({ pageType, config, updateField }: Props) {
  const schema = EVENT_MODULE_SCHEMAS[pageType];
  if (!schema) return null;

  return (
    <div className="space-y-4" data-testid={`schema-editor-${pageType}`}>
      <p className="text-xs text-muted-foreground">
        👥 互動元件設定 — 存檔後玩家端即用新設定；欄位留空會顯示內建預設文字
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
            data-testid={`schema-field-${field.key}`}
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
            data-testid={`schema-field-${field.key}`}
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
            data-testid={`schema-field-${field.key}`}
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
            data-testid={`schema-field-${field.key}`}
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
                  data-testid={`schema-field-${field.key}-${i}`}
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
              data-testid={`schema-field-${field.key}-add`}
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
                      data-testid={`schema-field-${field.key}-${i}-${col.key}`}
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
            data-testid={`schema-field-${field.key}-add`}
          >
            <Plus className="w-3 h-3 mr-1" />新增{field.itemLabel}
          </Button>
        </div>
      );
    }
  }
}
