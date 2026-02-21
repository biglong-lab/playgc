// 通用完成動作編輯器 — 任何頁面類型都可使用
// 讓遊戲設計師在頁面完成時設定變數操作、道具增減、加分等
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Trash2, Plus, ChevronDown, ChevronUp,
  Variable, Package, Zap, ToggleLeft,
} from "lucide-react";

interface ActionData {
  type: string;
  variableName?: string;
  value?: unknown;
  itemId?: string;
  points?: number;
}

const ACTION_TYPES = [
  { value: 'set_variable', label: '設定變數', icon: Variable, group: '變數' },
  { value: 'increment_variable', label: '累加變數', icon: Variable, group: '變數' },
  { value: 'decrement_variable', label: '遞減變數', icon: Variable, group: '變數' },
  { value: 'toggle_variable', label: '切換布林', icon: ToggleLeft, group: '變數' },
  { value: 'add_item', label: '給予道具', icon: Package, group: '道具' },
  { value: 'remove_item', label: '移除道具', icon: Package, group: '道具' },
  { value: 'add_score', label: '加分', icon: Zap, group: '分數' },
];

function getActionLabel(type: string): string {
  return ACTION_TYPES.find(a => a.value === type)?.label ?? type;
}

// ============================================================================
// 單一動作編輯
// ============================================================================
function ActionItem({
  action,
  index,
  onChange,
  onRemove,
}: {
  action: ActionData;
  index: number;
  onChange: (a: ActionData) => void;
  onRemove: () => void;
}) {
  const isVariable = action.type.includes('variable');
  const isItem = action.type === 'add_item' || action.type === 'remove_item';
  const isScore = action.type === 'add_score';
  const isToggle = action.type === 'toggle_variable';

  return (
    <div
      className="flex items-center gap-2 flex-wrap p-2 bg-muted/30 rounded-lg"
      data-testid={`action-${index}`}
    >
      <Select value={action.type} onValueChange={(v) => onChange({ ...action, type: v })}>
        <SelectTrigger className="w-32 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACTION_TYPES.map(at => (
            <SelectItem key={at.value} value={at.value}>
              <span className="flex items-center gap-1">
                <at.icon className="w-3 h-3" />
                {at.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isVariable && (
        <>
          <Input
            value={(action.variableName as string) || ""}
            onChange={(e) => onChange({ ...action, variableName: e.target.value })}
            placeholder="變數名"
            className="w-28 h-8"
          />
          {!isToggle && (
            <Input
              value={String(action.value ?? "")}
              onChange={(e) => {
                const num = Number(e.target.value);
                onChange({ ...action, value: isNaN(num) ? e.target.value : num });
              }}
              placeholder={action.type.includes('increment') || action.type.includes('decrement') ? "步長(預設1)" : "值"}
              className="w-24 h-8"
            />
          )}
        </>
      )}

      {isItem && (
        <Input
          value={(action.itemId as string) || ""}
          onChange={(e) => onChange({ ...action, itemId: e.target.value })}
          placeholder="道具 ID"
          className="w-36 h-8"
        />
      )}

      {isScore && (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={action.points ?? 0}
            onChange={(e) => onChange({ ...action, points: parseInt(e.target.value) || 0 })}
            placeholder="分數"
            className="w-20 h-8"
          />
          <span className="text-xs text-muted-foreground">分</span>
        </div>
      )}

      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={onRemove}>
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ============================================================================
// 主元件（可折疊）
// ============================================================================
export default function OnCompleteActionsEditor({
  config,
  updateField,
}: {
  config: Record<string, unknown>;
  updateField: (field: string, value: unknown) => void;
}) {
  const actions = (config.onCompleteActions || []) as ActionData[];
  const [expanded, setExpanded] = useState(actions.length > 0);

  const updateAction = (index: number, updated: ActionData) => {
    const newActions = [...actions];
    newActions[index] = updated;
    updateField("onCompleteActions", newActions);
  };

  const addAction = () => {
    const newAction: ActionData = { type: 'set_variable', variableName: '', value: '' };
    updateField("onCompleteActions", [...actions, newAction]);
    setExpanded(true);
  };

  const removeAction = (index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    updateField("onCompleteActions", newActions);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Variable className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">完成時動作</span>
          {actions.length > 0 && (
            <Badge variant="secondary" className="text-xs">{actions.length}</Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="p-3 pt-0 space-y-2">
          {actions.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              尚未設定動作。可在頁面完成時自動設定變數、給予道具或加分。
            </p>
          )}

          {actions.map((action, i) => (
            <ActionItem
              key={i}
              action={action}
              index={i}
              onChange={(updated) => updateAction(i, updated)}
              onRemove={() => removeAction(i)}
            />
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addAction}
            data-testid="button-add-action"
          >
            <Plus className="w-3 h-3 mr-1" /> 新增動作
          </Button>

          {actions.length > 0 && (
            <p className="text-xs text-muted-foreground">
              動作會在玩家完成此頁面時自動執行（在獎勵之後、導航之前）
            </p>
          )}
        </div>
      )}
    </div>
  );
}
