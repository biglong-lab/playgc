// 流程路由編輯器 — flow_router 頁面的設定表單
//
// 增強重點（消除硬編寫）：
//   1. has_item / not_has_item 改用 ItemSelect（不再讓管理員手寫 itemId）
//   2. 每條路由卡片頂部顯示「人類語言摘要」— 一眼看懂這條規則做什麼
//   3. Condition Tester 區塊：模擬變數/分數/道具，即時看會命中哪條規則
//   4. 隨機模式：權重比例條（占比視覺化）
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Trash2, Plus, ChevronDown, Play, GitBranch, Shuffle,
  FlaskConical, Target, PlayCircle,
} from "lucide-react";
import type { Page } from "@shared/schema";
import { getPageTypeInfo } from "./constants";
import { ItemSelect } from "@/components/shared/ItemSelect";

interface FlowConditionData {
  type: string;
  variableName?: string;
  variableValue?: unknown;
  valueType?: "string" | "number" | "boolean";
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
  { value: 'variable_equals', label: '變數等於', op: '=' },
  { value: 'variable_gt', label: '變數大於', op: '>' },
  { value: 'variable_lt', label: '變數小於', op: '<' },
  { value: 'variable_gte', label: '變數 ≥', op: '≥' },
  { value: 'variable_lte', label: '變數 ≤', op: '≤' },
  { value: 'has_item', label: '擁有道具', op: '' },
  { value: 'not_has_item', label: '沒有道具', op: '' },
  { value: 'score_above', label: '分數 ≥', op: '≥' },
  { value: 'score_below', label: '分數 <', op: '<' },
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
          const pageWithName = p as Page & { customName?: string | null };
          const label = pageWithName.customName?.trim() || info.label;
          return (
            <SelectItem key={p.id} value={p.id}>
              <span className="flex items-center gap-2">
                <info.icon className="w-4 h-4" />
                #{idx + 1} {label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// 把單一條件轉成人類可讀的一句話（用於規則摘要）
// ============================================================================
function describeCondition(
  cond: FlowConditionData,
  itemNameLookup: Map<string, string>,
): string {
  const typeInfo = CONDITION_TYPES.find((t) => t.value === cond.type);
  switch (cond.type) {
    case "variable_equals":
    case "variable_gt":
    case "variable_lt":
    case "variable_gte":
    case "variable_lte": {
      const name = cond.variableName || "（未指定變數）";
      const op = typeInfo?.op || "=";
      const v = cond.variableValue == null || cond.variableValue === ""
        ? "（未指定值）"
        : JSON.stringify(cond.variableValue);
      return `${name} ${op} ${v}`;
    }
    case "has_item": {
      const name = cond.itemId ? (itemNameLookup.get(cond.itemId) || cond.itemId) : "（未指定道具）";
      return `擁有「${name}」`;
    }
    case "not_has_item": {
      const name = cond.itemId ? (itemNameLookup.get(cond.itemId) || cond.itemId) : "（未指定道具）";
      return `沒有「${name}」`;
    }
    case "score_above":
      return `分數 ≥ ${cond.scoreThreshold ?? 0}`;
    case "score_below":
      return `分數 < ${cond.scoreThreshold ?? 0}`;
    default:
      return cond.type;
  }
}

// ============================================================================
// 路由摘要列（綠色箭頭 + 人類語言）
// ============================================================================
function RouteSummary({
  route,
  allPages,
  itemNameLookup,
}: {
  route: FlowRouteData;
  allPages: Page[];
  itemNameLookup: Map<string, string>;
}) {
  const joiner = route.conditionLogic === "and" ? "且" : "或";
  const conditionsText = route.conditions.length === 0
    ? "（無條件 — 永遠成立）"
    : route.conditions.map((c) => describeCondition(c, itemNameLookup)).join(`，${joiner} `);

  const target = (() => {
    if (!route.nextPageId || route.nextPageId === "_next") return "下一頁（依序）";
    if (route.nextPageId === "_end") return "結束遊戲";
    const idx = allPages.findIndex((p) => p.id === route.nextPageId);
    if (idx === -1) return "未知頁面";
    const p = allPages[idx];
    const info = getPageTypeInfo(p.pageType);
    const pwn = p as Page & { customName?: string | null };
    return `#${idx + 1} ${pwn.customName?.trim() || info.label}`;
  })();

  return (
    <div className="rounded-md bg-primary/5 border border-primary/20 px-2 py-1.5 text-xs leading-relaxed">
      <span className="text-muted-foreground">當</span>{" "}
      <span className="font-medium">{conditionsText}</span>
      <span className="text-primary mx-1.5">→</span>
      <span className="font-semibold text-primary">{target}</span>
    </div>
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
  gameId,
}: {
  condition: FlowConditionData;
  onChange: (c: FlowConditionData) => void;
  onRemove: () => void;
  index: number;
  gameId?: string;
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
          {(() => {
            const current = condition.variableValue;
            const valueType: "string" | "number" | "boolean" =
              condition.valueType ||
              (typeof current === "boolean" ? "boolean" :
               typeof current === "number" ? "number" : "string");

            return (
              <>
                <Select
                  value={valueType}
                  onValueChange={(v) => {
                    let newValue: unknown = current;
                    if (v === "number") newValue = Number(current) || 0;
                    else if (v === "boolean") newValue = !!current && current !== "false";
                    else newValue = current == null ? "" : String(current);
                    onChange({ ...condition, variableValue: newValue, valueType: v as "string" | "number" | "boolean" });
                  }}
                >
                  <SelectTrigger className="w-20 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">文字</SelectItem>
                    <SelectItem value="number">數字</SelectItem>
                    <SelectItem value="boolean">布林</SelectItem>
                  </SelectContent>
                </Select>
                {valueType === "boolean" ? (
                  <Select
                    value={String(!!current)}
                    onValueChange={(v) => onChange({ ...condition, variableValue: v === "true", valueType })}
                  >
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">true</SelectItem>
                      <SelectItem value="false">false</SelectItem>
                    </SelectContent>
                  </Select>
                ) : valueType === "number" ? (
                  <Input
                    type="number"
                    value={Number.isFinite(current as number) ? (current as number) : 0}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      onChange({ ...condition, variableValue: Number.isFinite(n) ? n : 0, valueType });
                    }}
                    placeholder="值"
                    className="w-24 h-8"
                  />
                ) : (
                  <Input
                    value={String(current ?? "")}
                    onChange={(e) => onChange({ ...condition, variableValue: e.target.value, valueType })}
                    placeholder="值"
                    className="w-24 h-8"
                  />
                )}
              </>
            );
          })()}
        </>
      )}

      {isItem && (
        // ✅ 改用 ItemSelect 取代 raw Input「道具 ID」，消除硬編寫
        <div className="w-52">
          <ItemSelect
            gameId={gameId}
            value={(condition.itemId as string) || ""}
            onChange={(id) => onChange({ ...condition, itemId: id })}
            placeholder="選擇道具..."
            testId={`condition-item-${index}`}
          />
        </div>
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
// 條件評估 — 給 Tester 用（前端 mirror，簡化版）
// ============================================================================
function evaluateCondition(
  cond: FlowConditionData,
  state: { variables: Record<string, unknown>; inventory: string[]; score: number },
): boolean {
  switch (cond.type) {
    case "variable_equals":
      return state.variables[cond.variableName || ""] === cond.variableValue;
    case "variable_gt":
      return Number(state.variables[cond.variableName || ""]) > Number(cond.variableValue);
    case "variable_lt":
      return Number(state.variables[cond.variableName || ""]) < Number(cond.variableValue);
    case "variable_gte":
      return Number(state.variables[cond.variableName || ""]) >= Number(cond.variableValue);
    case "variable_lte":
      return Number(state.variables[cond.variableName || ""]) <= Number(cond.variableValue);
    case "has_item":
      return !!cond.itemId && state.inventory.includes(cond.itemId);
    case "not_has_item":
      return !!cond.itemId && !state.inventory.includes(cond.itemId);
    case "score_above":
      return state.score >= (cond.scoreThreshold ?? 0);
    case "score_below":
      return state.score < (cond.scoreThreshold ?? 0);
    default:
      return false;
  }
}

function evaluateRoute(
  route: FlowRouteData,
  state: { variables: Record<string, unknown>; inventory: string[]; score: number },
): boolean {
  if (route.conditions.length === 0) return true;
  if (route.conditionLogic === "and") {
    return route.conditions.every((c) => evaluateCondition(c, state));
  }
  return route.conditions.some((c) => evaluateCondition(c, state));
}

// ============================================================================
// Tester 面板：模擬狀態看會路由到哪條
// ============================================================================
function ConditionTester({
  routes,
  defaultNextPageId,
  allPages,
}: {
  routes: FlowRouteData[];
  defaultNextPageId?: string;
  allPages: Page[];
}) {
  const [testScore, setTestScore] = useState(0);
  const [testInventory, setTestInventory] = useState<string>("");
  const [testVariables, setTestVariables] = useState<string>("{}");

  const result = useMemo(() => {
    let variables: Record<string, unknown> = {};
    try {
      variables = JSON.parse(testVariables);
    } catch {
      return { error: "變數 JSON 格式錯誤" };
    }
    const inventory = testInventory.split(",").map((s) => s.trim()).filter(Boolean);
    const state = { variables, inventory, score: testScore };

    for (let i = 0; i < routes.length; i++) {
      if (evaluateRoute(routes[i], state)) {
        return { matchedIndex: i, route: routes[i] };
      }
    }
    return { matchedIndex: -1, route: null, defaultNextPageId };
  }, [routes, defaultNextPageId, testScore, testInventory, testVariables]);

  const resolveTarget = (nextPageId?: string): string => {
    if (!nextPageId || nextPageId === "_next") return "下一頁（依序）";
    if (nextPageId === "_end") return "結束遊戲";
    const idx = allPages.findIndex((p) => p.id === nextPageId);
    if (idx === -1) return "未知頁面";
    const p = allPages[idx];
    const pwn = p as Page & { customName?: string | null };
    return `#${idx + 1} ${pwn.customName?.trim() || getPageTypeInfo(p.pageType).label}`;
  };

  return (
    <Card className="p-3 border-dashed">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium">條件測試（僅試算，不會影響實際資料）</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">模擬分數</label>
          <Input
            type="number"
            value={testScore}
            onChange={(e) => setTestScore(Number(e.target.value) || 0)}
            className="h-8"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">道具清單（逗號分隔 ID）</label>
          <Input
            value={testInventory}
            onChange={(e) => setTestInventory(e.target.value)}
            placeholder="item-1, item-2"
            className="h-8 font-mono text-xs"
          />
        </div>
        <div className="col-span-3">
          <label className="text-xs text-muted-foreground mb-1 block">變數（JSON 格式）</label>
          <Input
            value={testVariables}
            onChange={(e) => setTestVariables(e.target.value)}
            placeholder='{"chapter": 2, "isHero": true}'
            className="h-8 font-mono text-xs"
          />
        </div>
      </div>

      {/* 結果 */}
      <div className="mt-2 flex items-start gap-2">
        <Target className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
        {"error" in result ? (
          <span className="text-xs text-destructive">{result.error}</span>
        ) : result.matchedIndex >= 0 ? (
          <div className="text-xs">
            <span className="text-muted-foreground">命中規則 </span>
            <Badge variant="secondary" className="mx-1">#{result.matchedIndex + 1}</Badge>
            <span className="text-muted-foreground">→ 跳轉到 </span>
            <span className="font-semibold text-primary">
              {resolveTarget(result.route!.nextPageId)}
            </span>
          </div>
        ) : (
          <div className="text-xs">
            <span className="text-muted-foreground">無規則命中 → 走預設頁面：</span>
            <span className="font-semibold ml-1">{resolveTarget(defaultNextPageId)}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================================
// 主元件
// ============================================================================
export default function FlowRouterEditor({
  config,
  updateField,
  allPages,
  gameId,
}: {
  config: ConfigRecord;
  updateField: (field: string, value: ConfigValue) => void;
  allPages: Page[];
  gameId?: string;
}) {
  const mode = (config.mode as string) || 'conditional';
  const routes = (config.routes || []) as FlowRouteData[];
  const [showTester, setShowTester] = useState(false);

  // items 名稱查找（給摘要顯示用）— 為了不依賴 ItemSelect 內部 cache
  // 若 game 內無 items 也沒關係，summary 會 fallback 成 itemId 本身
  const itemNameLookup = useMemo(() => new Map<string, string>(), []);

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

  // 隨機模式總權重（for 比例條）
  const totalWeight = useMemo(() => {
    if (mode !== "random") return 0;
    return routes.reduce(
      (sum, r) => sum + (r.conditions[0]?.weight ?? 1),
      0,
    );
  }, [mode, routes]);

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
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium">路由規則</label>
          {mode === "conditional" && routes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTester(!showTester)}
              className="gap-1 text-xs"
            >
              <PlayCircle className="w-3 h-3" />
              {showTester ? "隱藏測試" : "開啟測試"}
            </Button>
          )}
        </div>

        {/* 🧪 Condition Tester */}
        {mode === "conditional" && showTester && routes.length > 0 && (
          <div className="mb-3">
            <ConditionTester
              routes={routes}
              defaultNextPageId={config.defaultNextPageId as string | undefined}
              allPages={allPages}
            />
          </div>
        )}

        <div className="space-y-3">
          {routes.map((route, i) => {
            // 隨機模式下：計算該路線佔比（權重 / 總權重）
            const weight = route.conditions[0]?.weight ?? 1;
            const pct = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;

            return (
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

                {/* 📖 人類語言摘要（即時反映目前設定） */}
                {mode === "conditional" && (
                  <RouteSummary
                    route={route}
                    allPages={allPages}
                    itemNameLookup={itemNameLookup}
                  />
                )}

                {/* conditional 模式：條件列表 */}
                {mode === 'conditional' && (
                  <div className="space-y-2 pl-2 border-l-2 border-border">
                    {route.conditions.map((cond, ci) => (
                      <ConditionEditor
                        key={ci}
                        condition={cond}
                        index={ci}
                        gameId={gameId}
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

                {/* random 模式：權重 + 比例條 */}
                {mode === 'random' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-muted-foreground shrink-0">
                        權重: {weight}
                      </label>
                      <Slider
                        value={[weight]}
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
                      <Badge variant="secondary" className="text-xs">
                        {pct}%
                      </Badge>
                    </div>
                    {/* 比例視覺條 */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
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
            );
          })}

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
