// 碎片收集 / 條件驗證編輯器
// 支援兩種模式：fragment（碎片收集）+ conditions（條件檢查）
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Puzzle, Package, Plus, X as XIcon, ShieldCheck, AlertCircle } from "lucide-react";
import { LocationSettingsSection, type EditorProps } from "./page-config-shared";
import type { Item } from "@shared/schema";
import { LocationSelect } from "@/components/shared/LocationSelect";

interface Fragment {
  id: string;
  label: string;
  value: string;
  order: number;
  sourceItemId?: string;
}

type ConditionType = "has_item" | "has_points" | "visited_location";

interface Condition {
  type: ConditionType;
  itemId?: string;
  minPoints?: number;
  locationId?: string;
  description?: string;
}

interface ConditionalVerifyEditorProps extends EditorProps {
  gameId: string;
}

export default function ConditionalVerifyEditor({
  config,
  updateField,
  gameId,
}: ConditionalVerifyEditorProps) {
  const fragments = (config.fragments || []) as Fragment[];
  const conditions = (config.conditions || []) as Condition[];

  // 讀取當前遊戲的 items（用來綁 fragment.sourceItemId / condition.itemId）
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/games", gameId, "items"],
    enabled: !!gameId && gameId !== "new",
  });

  const updateFragments = (newFragments: Fragment[]) => {
    updateField("fragments", newFragments);
    if (config.fragmentType !== "custom") {
      const targetCode = newFragments.map((f) => f.value).join("");
      updateField("targetCode", targetCode);
    }
  };

  const generateFragments = (type: string, count: number) => {
    const existingFragments = fragments;
    const newFragments: Fragment[] = [];
    for (let i = 0; i < count; i++) {
      const existing = existingFragments[i];
      let value = existing?.value || "";
      if (!value) {
        if (type === "numbers") value = String(Math.floor(Math.random() * 10));
        else if (type === "letters") value = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      }
      newFragments.push({
        id: existing?.id || `f${i + 1}`,
        label: existing?.label || `碎片 ${i + 1}/${count}`,
        value,
        order: i + 1,
        sourceItemId: existing?.sourceItemId,
      });
    }
    return newFragments;
  };

  const addCondition = () => {
    const newConditions: Condition[] = [
      ...conditions,
      { type: "has_item", itemId: "", description: "" },
    ];
    updateField("conditions", newConditions);
  };

  const updateCondition = (i: number, patch: Partial<Condition>) => {
    const next = [...conditions];
    next[i] = { ...next[i], ...patch };
    updateField("conditions", next);
  };

  const removeCondition = (i: number) => {
    updateField("conditions", conditions.filter((_, idx) => idx !== i));
  };

  const hasItemsList = items.length > 0;

  return (
    <div className="space-y-4">
      {/* 示範模式開關（最上方顯著位置） */}
      <div className="border rounded-lg p-3 bg-blue-500/5 border-blue-500/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium flex items-center gap-2">
              示範模式（Demo Mode）
            </label>
            <p className="text-xs text-muted-foreground mt-1">
              開啟後：<b>純劇情展示</b>，玩家按繼續即可通過，不要求實際持有道具。
              適合模組範本 / 劇情 demo。正式遊戲請關閉並為每個碎片綁定 <b>sourceItemId</b>。
            </p>
          </div>
          <Switch
            checked={config.demoMode === true}
            onCheckedChange={(v) => updateField("demoMode", v)}
            data-testid="switch-demo-mode"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={config.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="碎片收集任務"
          data-testid="config-fragment-title"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">任務說明</label>
        <Textarea
          value={config.instruction || ""}
          onChange={(e) => updateField("instruction", e.target.value)}
          placeholder="收集所有碎片，組成正確的密碼"
          rows={2}
          data-testid="config-fragment-instruction"
        />
      </div>

      {/* ============ 碎片收集模式 ============ */}
      <div className="border rounded-lg p-3 space-y-4 bg-accent/5">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Puzzle className="w-4 h-4" />
          碎片收集設定
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">碎片類型</label>
            <Select
              value={config.fragmentType || "numbers"}
              onValueChange={(value) => {
                updateField("fragmentType", value);
                updateFragments(generateFragments(value, config.fragmentCount || 4));
              }}
            >
              <SelectTrigger data-testid="config-fragment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="numbers">數字碎片 (0-9)</SelectItem>
                <SelectItem value="letters">字母碎片 (A-Z)</SelectItem>
                <SelectItem value="custom">自定義內容</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">碎片數量</label>
            <Input
              type="number"
              value={config.fragmentCount || 4}
              onChange={(e) => {
                const count = Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0));
                updateField("fragmentCount", count);
                updateFragments(generateFragments(config.fragmentType || "numbers", count));
              }}
              min={0}
              max={10}
              data-testid="config-fragment-count"
            />
          </div>
        </div>

        {fragments.length > 0 && (
          <>
            <div>
              <label className="text-sm font-medium mb-2 block">驗證模式</label>
              <Select
                value={config.verificationMode || "order_matters"}
                onValueChange={(value) => updateField("verificationMode", value)}
              >
                <SelectTrigger data-testid="config-verification-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order_matters">順序重要（依序輸入）</SelectItem>
                  <SelectItem value="order_independent">順序不重要（只需全部收集）</SelectItem>
                  <SelectItem value="all_collected">只需確認收集（無需輸入）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <Package className="w-4 h-4" />
                碎片配置
                <Badge variant="secondary" className="text-xs">{fragments.length} 個碎片</Badge>
              </label>
              {!hasItemsList && config.demoMode !== true && (
                <div className="flex items-start gap-2 p-2 mb-2 rounded bg-amber-500/10 text-amber-700 text-xs">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>尚未建立道具。玩家需透過本遊戲的道具系統取得碎片，請先到「道具管理」建立道具後回來綁定（或暫時開啟「示範模式」）。</span>
                </div>
              )}
              <div className="space-y-2">
                {fragments.map((fragment, i) => (
                  <div key={fragment.id || i} className="bg-background border rounded-lg p-2 space-y-2">
                    <div className="flex gap-2 items-center">
                      <div className="flex-shrink-0 w-16 text-center">
                        <Badge variant="outline" className="text-xs">碎片 {i + 1}</Badge>
                      </div>
                      <Input
                        value={fragment.value || ""}
                        onChange={(e) => {
                          const next = [...fragments];
                          next[i] = { ...next[i], value: e.target.value };
                          updateFragments(next);
                        }}
                        placeholder={
                          config.fragmentType === "numbers" ? "0-9"
                            : config.fragmentType === "letters" ? "A-Z"
                            : "內容"
                        }
                        className="w-24 text-center font-mono"
                        data-testid={`config-fragment-value-${i}`}
                      />
                      <Input
                        value={fragment.label || ""}
                        onChange={(e) => {
                          const next = [...fragments];
                          next[i] = { ...next[i], label: e.target.value };
                          updateField("fragments", next);
                        }}
                        placeholder="碎片標籤"
                        className="flex-1"
                        data-testid={`config-fragment-label-${i}`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0 w-16">來源道具</span>
                      <Select
                        value={fragment.sourceItemId || "_none"}
                        onValueChange={(value) => {
                          const next = [...fragments];
                          next[i] = {
                            ...next[i],
                            sourceItemId: value === "_none" ? undefined : value,
                          };
                          updateField("fragments", next);
                        }}
                      >
                        <SelectTrigger
                          className="flex-1"
                          data-testid={`config-fragment-item-${i}`}
                        >
                          <SelectValue placeholder="選擇道具" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">
                            <span className="text-muted-foreground">（未設定，玩家無法取得）</span>
                          </SelectItem>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {!fragment.sourceItemId && config.demoMode !== true && (
                      <p className="text-[11px] text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        未綁定道具，玩家將無法收集此碎片
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">目標密碼</label>
              <Input
                value={config.targetCode || ""}
                onChange={(e) => updateField("targetCode", e.target.value)}
                placeholder="自動生成或手動設定"
                className="font-mono"
                data-testid="config-target-code"
              />
              <p className="text-xs text-muted-foreground mt-1">
                留空自動依碎片值順序生成；自訂時玩家需輸入此內容。
              </p>
            </div>
          </>
        )}
      </div>

      {/* ============ 條件驗證模式（獨立存在，可搭配碎片） ============ */}
      <div className="border rounded-lg p-3 space-y-3 bg-accent/5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            條件驗證
            <Badge variant="secondary" className="text-xs">{conditions.length} 個條件</Badge>
          </h4>
          <Button size="sm" variant="outline" onClick={addCondition} data-testid="button-add-condition">
            <Plus className="w-3 h-3 mr-1" />新增條件
          </Button>
        </div>

        {conditions.length > 0 && (
          <div className="flex items-center gap-2">
            <Switch
              checked={config.allRequired !== false}
              onCheckedChange={(checked) => updateField("allRequired", checked)}
              data-testid="switch-all-required"
            />
            <span className="text-xs">
              {config.allRequired !== false ? "需符合所有條件（AND）" : "符合任一條件即可（OR）"}
            </span>
          </div>
        )}

        <div className="space-y-2">
          {conditions.map((cond, i) => (
            <div key={i} className="bg-background border rounded-lg p-2 space-y-2">
              <div className="flex items-center gap-2">
                <Select
                  value={cond.type}
                  onValueChange={(v) => updateCondition(i, { type: v as ConditionType })}
                >
                  <SelectTrigger className="flex-1" data-testid={`condition-type-${i}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="has_item">持有道具</SelectItem>
                    <SelectItem value="has_points">分數達標</SelectItem>
                    <SelectItem value="visited_location">造訪地點</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => removeCondition(i)} data-testid={`condition-remove-${i}`}>
                  <XIcon className="w-4 h-4" />
                </Button>
              </div>

              {cond.type === "has_item" && (
                <Select
                  value={cond.itemId || "_none"}
                  onValueChange={(v) => updateCondition(i, { itemId: v === "_none" ? undefined : v })}
                >
                  <SelectTrigger data-testid={`condition-item-${i}`}>
                    <SelectValue placeholder="選擇道具" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none"><span className="text-muted-foreground">（請選擇道具）</span></SelectItem>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {cond.type === "has_points" && (
                <Input
                  type="number"
                  value={cond.minPoints ?? 0}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    updateCondition(i, { minPoints: Number.isFinite(n) ? n : 0 });
                  }}
                  placeholder="最低分數"
                  min={0}
                  data-testid={`condition-points-${i}`}
                />
              )}

              {cond.type === "visited_location" && (
                <LocationSelect
                  gameId={gameId}
                  value={cond.locationId || ""}
                  onChange={(id) => updateCondition(i, { locationId: id })}
                  allowEmpty
                  placeholder="選擇地點..."
                  testId={`condition-location-${i}`}
                />
              )}

              <Input
                value={cond.description || ""}
                onChange={(e) => updateCondition(i, { description: e.target.value })}
                placeholder="條件描述（可選，玩家看到的說明）"
                className="text-xs"
                data-testid={`condition-description-${i}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ============ 結果訊息 ============ */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="text-sm font-medium mb-2 block">成功訊息</label>
          <Input
            value={config.successMessage || ""}
            onChange={(e) => updateField("successMessage", e.target.value)}
            placeholder="解鎖成功！"
            data-testid="config-success-message"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">失敗訊息</label>
          <Input
            value={config.failureMessage || ""}
            onChange={(e) => updateField("failureMessage", e.target.value)}
            placeholder="條件未達成，請先完成必要任務"
            data-testid="config-failure-message"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">完成獎勵分數</label>
        <Input
          type="number"
          value={config.rewardPoints ?? 0}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            updateField("rewardPoints", Number.isFinite(n) ? n : 0);
          }}
          min={0}
          max={1000}
          data-testid="config-fragment-reward"
        />
      </div>

      <LocationSettingsSection config={config} updateField={updateField} />
    </div>
  );
}
