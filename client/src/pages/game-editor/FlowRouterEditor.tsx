// 流程路由編輯器 — flow_router 頁面的設定表單
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, ChevronDown, Play, GitBranch, Shuffle } from "lucide-react";
import type { Page } from "@shared/schema";
import { getPageTypeInfo } from "./constants";

interface FlowConditionData {
  type: string;
  variableName?: string;
  variableValue?: unknown;
  itemId?: string;
  scoreThreshold?: number;
  weight?: number;
}

interface FlowRouteData {
  id: string;
  label?: string;
  conditions: FlowConditionData[];
  conditionLogic: 'and' | 'or';
  nextPageId: string;
}

type ConfigRecord = Record<string, unknown>;
type ConfigValue = unknown;

const CONDITION_TYPES = [
  { value: 'variable_equals', label: '變數等於' },
  { value: 'variable_gt', label: '變數大於' },
  { value: 'variable_lt', label: '變數小於' },
  { value: 'variable_gte', label: '變數 ≥' },
  { value: 'variable_lte', label: '變數 ≤' },
  { value: 'has_item', label: '擁有道具' },
  { value: 'not_has_item', label: '沒有道具' },
  { value: 'score_above', label: '分數 ≥' },
  { value: 'score_below', label: '分數 <' },
];

// ============================================================================
// 頁面選擇器（共用）
// ============================================================================
function PageSelector({
  value,
  onChange,
  allPages,
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  allPages: Page[];
  testId?: string;
}) {
  return (
    <Select value={value || "_next"} onValueChange={onChange}>
      <SelectTrigger data-testid={testId}>
        <SelectValue placeholder="選擇目標頁面" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_next">
          <span className="flex items-center gap-2">
            <ChevronDown className="w-4 h-4" /> 下一頁 (順序)
          </span>
        </SelectItem>
        <SelectItem value="_end">
          <span className="flex items-center gap-2">
            <Play className="w-4 h-4" /> 結束遊戲
          </span>
        </SelectItem>
        {allPages.map((p, idx) => {
          const info = getPageTypeInfo(p.pageType);
          return (
            <SelectItem key={p.id} value={p.id}>
              <span className="flex items-center gap-2">
                <info.icon className="w-4 h-4" />
                #{idx + 1} {info.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// 條件編輯器
// ============================================================================
function ConditionEditor({
  condition,
  onChange,
  onRemove,
  index,
}: {
  condition: FlowConditionData;
  onChange: (c: FlowConditionData) => void;
  onRemove: () => void;
  index: number;
}) {
  const isVariable = condition.type.startsWith('variable_');
  const isItem = condition.type === 'has_item' || condition.type === 'not_has_item';
  const isScore = condition.type === 'score_above' || condition.type === 'score_below';

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid={`condition-${index}`}>
      <Select
        value={condition.type}
        onValueChange={(v) => onChange({ ...condition, type: v })}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONDITION_TYPES.map(ct => (
            <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isVariable && (
        <>
          <Input
            value={(condition.variableName as string) || ""}
            onChange={(e) => onChange({ ...condition, variableName: e.target.value })}
            placeholder="變數名"
            className="w-28 h-8"
          />
          <Input
            value={String(condition.variableValue ?? "")}
            onChange={(e) => {
              const num = Number(e.target.value);
              onChange({ ...condition, variableValue: isNaN(num) ? e.target.value : num });
            }}
            placeholder="值"
            className="w-20 h-8"
          />
        </>
      )}

      {isItem && (
        <Input
          value={(condition.itemId as string) || ""}
          onChange={(e) => onChange({ ...condition, itemId: e.target.value })}
          placeholder="道具 ID"
          className="w-36 h-8"
        />
      )}

      {isScore && (
        <Input
          type="number"
          value={condition.scoreThreshold ?? 0}
          onChange={(e) => onChange({ ...condition, scoreThreshold: parseInt(e.target.value) || 0 })}
          placeholder="分數"
          className="w-20 h-8"
        />
      )}

      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove}>
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ============================================================================
// 主元件
// ============================================================================
export default function FlowRouterEditor({
  config,
  updateField,
  allPages,
}: {
  config: ConfigRecord;
  updateField: (field: string, value: ConfigValue) => void;
  allPages: Page[];
}) {
  const mode = (config.mode as string) || 'conditional';
  const routes = (config.routes || []) as FlowRouteData[];

  const updateRoute = (index: number, updated: FlowRouteData) => {
    const newRoutes = [...routes];
    newRoutes[index] = updated;
    updateField("routes", newRoutes);
  };

  const addRoute = () => {
    const newRoute: FlowRouteData = {
      id: crypto.randomUUID(),
      label: "",
      conditions: [{ type: 'variable_equals', variableName: '', variableValue: '' }],
      conditionLogic: 'and',
      nextPageId: "",
    };
    updateField("routes", [...routes, newRoute]);
  };

  const removeRoute = (index: number) => {
    updateField("routes", routes.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* 模式切換 */}
      <div>
        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
          路由模式
          <Badge variant="secondary" className="text-xs">
            {mode === 'conditional' ? '條件分支' : '隨機路徑'}
          </Badge>
        </label>
        <div className="flex gap-2">
          <Button
            variant={mode === 'conditional' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateField("mode", "conditional")}
            className="gap-1"
          >
            <GitBranch className="w-4 h-4" /> 條件分支
          </Button>
          <Button
            variant={mode === 'random' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateField("mode", "random")}
            className="gap-1"
          >
            <Shuffle className="w-4 h-4" /> 隨機路徑
          </Button>
        </div>
      </div>

      {/* 路由規則列表 */}
      <div>
        <label className="text-sm font-medium mb-3 block">路由規則</label>
        <div className="space-y-3">
          {routes.map((route, i) => (
            <Card key={route.id} className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">#{i + 1}</Badge>
                  <Input
                    value={route.label || ""}
                    onChange={(e) => updateRoute(i, { ...route, label: e.target.value })}
                    placeholder="規則描述（選填）"
                    className="h-8 w-48"
                  />
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeRoute(i)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* conditional 模式：條件列表 */}
              {mode === 'conditional' && (
                <div className="space-y-2 pl-2 border-l-2 border-border">
                  {route.conditions.map((cond, ci) => (
                    <ConditionEditor
                      key={ci}
                      condition={cond}
                      index={ci}
                      onChange={(updated) => {
                        const newConds = [...route.conditions];
                        newConds[ci] = updated;
                        updateRoute(i, { ...route, conditions: newConds });
                      }}
                      onRemove={() => {
                        updateRoute(i, {
                          ...route,
                          conditions: route.conditions.filter((_, idx) => idx !== ci),
                        });
                      }}
                    />
                  ))}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => updateRoute(i, {
                        ...route,
                        conditions: [...route.conditions, { type: 'variable_equals' }],
                      })}
                    >
                      <Plus className="w-3 h-3 mr-1" /> 新增條件
                    </Button>
                    {route.conditions.length > 1 && (
                      <Select
                        value={route.conditionLogic}
                        onValueChange={(v) => updateRoute(i, {
                          ...route,
                          conditionLogic: v as 'and' | 'or',
                        })}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="and">全部滿足</SelectItem>
                          <SelectItem value="or">任一滿足</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )}

              {/* random 模式：權重 */}
              {mode === 'random' && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground shrink-0">
                    權重: {route.conditions[0]?.weight ?? 1}
                  </label>
                  <Slider
                    value={[route.conditions[0]?.weight ?? 1]}
                    onValueChange={([v]) => {
                      updateRoute(i, {
                        ...route,
                        conditions: [{ type: 'random', weight: v }],
                      });
                    }}
                    min={1}
                    max={10}
                    step={1}
                    className="flex-1"
                  />
                </div>
              )}

              {/* 跳轉目標 */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground shrink-0">跳轉到:</label>
                <PageSelector
                  value={route.nextPageId}
                  onChange={(v) => updateRoute(i, {
                    ...route,
                    nextPageId: v === "_next" ? "" : v,
                  })}
                  allPages={allPages}
                  testId={`route-next-${i}`}
                />
              </div>
            </Card>
          ))}

          <Button variant="outline" size="sm" onClick={addRoute} data-testid="button-add-route">
            <Plus className="w-4 h-4 mr-1" /> 新增規則
          </Button>
        </div>
      </div>

      {/* 預設 fallback */}
      {mode === 'conditional' && (
        <div>
          <label className="text-sm font-medium mb-2 block">預設頁面（所有規則不滿足時）</label>
          <PageSelector
            value={(config.defaultNextPageId as string) || "_next"}
            onChange={(v) => updateField("defaultNextPageId", v === "_next" ? undefined : v)}
            allPages={allPages}
            testId="route-default"
          />
        </div>
      )}

      {/* 說明 */}
      <div className="bg-accent/50 rounded-lg p-3">
        <p className="text-xs text-muted-foreground">
          {mode === 'conditional'
            ? "條件分支：按順序評估每條規則，第一個滿足條件的規則會觸發跳轉。玩家不會看到此頁面。"
            : "隨機路徑：根據權重隨機選擇一條路徑跳轉。權重越高，被選中的機率越大。"
          }
        </p>
      </div>
    </div>
  );
}
