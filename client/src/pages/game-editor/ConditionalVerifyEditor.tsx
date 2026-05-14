// 碎片收集 / 條件驗證編輯器
// 支援兩種模式：fragment（碎片收集）+ conditions（條件檢查）
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Puzzle, Package, Plus, X as XIcon, ShieldCheck, AlertCircle, Image as ImageIcon, Type as TypeIcon } from "lucide-react";
import { LocationSettingsSection, type EditorProps } from "./page-config-shared";
import type { Item } from "@shared/schema";
import { LocationSelect } from "@/components/shared/LocationSelect";
import type { MediaUploadButtonProps } from "./page-config-inline-editors";

/**
 * 依碎片數計算 grid (cols × rows)
 * 2026-05-13 P2-5：碎片圖切割切割算法
 */
export function calcFragmentGrid(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n === 3) return { cols: 3, rows: 1 };
  if (n === 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 8) return { cols: 4, rows: 2 };
  if (n === 9) return { cols: 3, rows: 3 };
  return { cols: 5, rows: 2 };
}

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
  // 🆕 2026-05-12 #2: 傳遊戲所有 pages、讓 LocationSelect 顯示對應 page #N
  allPages?: Array<{
    id: string;
    pageOrder: number;
    pageType: string;
    customName?: string | null;
    config?: unknown;
  }>;
  // 🆕 2026-05-13 P2-5：碎片圖切割上傳元件
  MediaUploadButton?: React.FC<MediaUploadButtonProps>;
  // 🆕 2026-05-14：batch update 多個 fields 一次寫入（避免 stale closure 覆蓋）
  updateFields?: (patch: Record<string, unknown>) => void;
}

export default function ConditionalVerifyEditor({
  config,
  updateField,
  updateFields,
  gameId,
  allPages,
  MediaUploadButton,
}: ConditionalVerifyEditorProps) {
  const fragments = (config.fragments || []) as Fragment[];
  const conditions = (config.conditions || []) as Condition[];

  // 讀取當前遊戲的 items（用來綁 fragment.sourceItemId / condition.itemId）
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/games", gameId, "items"],
    enabled: !!gameId && gameId !== "new",
  });

  // 🐛 修：第一次進編輯器時 admin 看似已有預設值（碎片類型 + 數量）
  // 但 fragments[] 是空陣列 → 玩家端 isFragmentMode=false → 看不到碎片 UI
  // 自動初始化：fragmentCount 未設或 > 0 且 fragments 為空 → 自動 generate
  //
  // 🐛 2026-05-14：修「fragmentCount = 0 / NULL 導致玩家端看不到碎片」
  // - 原 useEffect 只跑一次、且用 `|| 4` 把 0 視為 falsy → 0 被當沒設
  // - 改成 useEffect 監聽 fragmentCount + fragmentSource 變化、自動補 fragments
  // - hasCount 用 `?? null` + 強制最小值 2（不允許 0）
  useEffect(() => {
    const rawCount = config.fragmentCount as number | undefined;
    // 預設 4 個碎片、最少 2 個（圖片切割 1 塊無意義）
    let hasCount: number;
    if (rawCount === undefined || rawCount === null || rawCount < 2) {
      hasCount = 4;
    } else {
      hasCount = Math.min(10, rawCount);
    }
    const isFragmentCountDirty = rawCount !== hasCount;

    if (hasCount > 0 && fragments.length === 0) {
      const type = (config.fragmentType as string | undefined) || "numbers";
      const generated: Fragment[] = [];
      for (let i = 0; i < hasCount; i++) {
        let value = "";
        if (type === "numbers") value = String(Math.floor(Math.random() * 10));
        else if (type === "letters") value = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        generated.push({
          id: `f${i + 1}`,
          label: `碎片 ${i + 1}/${hasCount}`,
          value,
          order: i + 1,
        });
      }
      // 🐛 2026-05-14 重要修補：原本連續 call updateField 多次有 stale closure bug
      //   每次 updateField 都用 {...config, [field]: value}，config 是 stale closure，
      //   後面的 call 覆蓋前面 → fragments/fragmentCount/fragmentType 只剩最後一個被寫入。
      //   這就是業主回報「碎片數量永遠是 0」的根因。
      // 修法：用 updateFields batch 一次寫所有 changes、共用同一個 spread。
      const patch: Record<string, unknown> = { fragments: generated };
      if (isFragmentCountDirty) patch.fragmentCount = hasCount;
      if (!config.fragmentType) patch.fragmentType = type;
      if (type !== "custom") {
        patch.targetCode = generated.map((f) => f.value).join("");
      }
      if (updateFields) {
        updateFields(patch);
      } else {
        // fallback（理論上不會走到、updateFields 已從 PageConfigEditor 傳下來）
        Object.entries(patch).forEach(([k, v]) => updateField(k, v as never));
      }
    }
    // 🐛 2026-05-14：依賴 fragmentCount + fragmentSource 變化、補空 fragments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.fragmentCount, config.fragmentSource]);

  const updateFragments = (newFragments: Fragment[]) => {
    // 🐛 2026-05-14：同 batch 修補、避免 stale closure 覆蓋
    if (updateFields) {
      const patch: Record<string, unknown> = { fragments: newFragments };
      if (config.fragmentType !== "custom") {
        patch.targetCode = newFragments.map((f) => f.value).join("");
      }
      updateFields(patch);
      return;
    }
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

        {/* 🆕 2026-05-13 P2-5（2026-05-14 強化）：碎片來源（文字 / 圖片切割） */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            碎片來源 <span className="text-xs text-muted-foreground">（點擊切換、立即生效、記得最後按儲存）</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateField("fragmentSource", "text")}
              className={`flex flex-col items-center gap-1 justify-center p-4 rounded-lg border-2 transition-all ${
                (config.fragmentSource || "text") === "text"
                  ? "border-primary bg-primary/15 ring-2 ring-primary/40 shadow-sm"
                  : "border-border hover:border-primary/50 opacity-60"
              }`}
              data-testid="btn-fragment-source-text"
            >
              <TypeIcon className="w-5 h-5" />
              <span className="text-sm font-semibold">文字碎片</span>
              {(config.fragmentSource || "text") === "text" && (
                <span className="text-[10px] text-primary font-bold">✓ 已選</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => updateField("fragmentSource", "image")}
              className={`flex flex-col items-center gap-1 justify-center p-4 rounded-lg border-2 transition-all ${
                config.fragmentSource === "image"
                  ? "border-primary bg-primary/15 ring-2 ring-primary/40 shadow-sm"
                  : "border-border hover:border-primary/50 opacity-60"
              }`}
              data-testid="btn-fragment-source-image"
            >
              <ImageIcon className="w-5 h-5" />
              <span className="text-sm font-semibold">圖片切割</span>
              {config.fragmentSource === "image" && (
                <span className="text-[10px] text-primary font-bold">✓ 已選</span>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 文字模式才顯示 fragmentType（圖片模式不需要）*/}
          {(config.fragmentSource || "text") === "text" && (
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
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">
              碎片數量 <span className="text-xs text-muted-foreground">（2-10）</span>
            </label>
            <Input
              type="number"
              value={(config.fragmentCount as number | undefined) ?? 4}
              onChange={(e) => {
                const raw = e.target.value;
                // 🐛 2026-05-14：空白不歸零、parseInt NaN fallback 4（不歸 0 = disable）
                const parsed = raw === "" ? 4 : parseInt(raw, 10);
                const safe = Number.isFinite(parsed) ? parsed : 4;
                const count = Math.max(2, Math.min(10, safe));
                updateField("fragmentCount", count);
                updateFragments(generateFragments(config.fragmentType || "numbers", count));
              }}
              min={2}
              max={10}
              data-testid="config-fragment-count"
            />
          </div>
        </div>

        {/* 🆕 圖片切割模式：上傳 + 預覽 grid */}
        {config.fragmentSource === "image" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm font-medium">碎片圖片</label>
              {MediaUploadButton && (
                <MediaUploadButton
                  id="fragment-image-upload"
                  accept="image/*"
                  onUploaded={(url) => updateField("fragmentImageUrl", url)}
                />
              )}
              {config.fragmentImageUrl && (
                <>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    已上傳
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => updateField("fragmentImageUrl", "")}
                    className="text-destructive ml-auto"
                  >
                    <XIcon className="w-4 h-4" />
                    移除圖片
                  </Button>
                </>
              )}
            </div>
            {/* 🔧 2026-05-14：上傳後顯示縮圖、admin 一眼確認檔對 */}
            {config.fragmentImageUrl && (
              <img
                src={config.fragmentImageUrl}
                alt="原圖縮圖"
                className="rounded-md border max-w-[160px] max-h-[160px] object-contain bg-muted/30"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            {!config.fragmentImageUrl && (
              <div className="text-xs text-muted-foreground p-3 border rounded bg-muted/40 space-y-1">
                <p>上傳一張完整圖、系統會依「碎片數量」自動切成等份。</p>
                <p>建議：比例 1:1 或 16:9、圖檔 &lt; 1MB、碎片數 <b>4-9</b>（10 塊以上會切太細）。</p>
                <p>玩家拼齊所有碎片 → 自動通過、不需輸入密碼。</p>
              </div>
            )}
            {!!config.fragmentImageUrl && (() => {
              const count = (config.fragmentCount as number) || 4;
              const { cols, rows } = calcFragmentGrid(count);
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground">切片預覽</span>
                    <Badge variant="secondary" className="text-xs">{cols} × {rows}</Badge>
                  </div>
                  <div
                    className="grid gap-1 rounded border p-1 bg-background"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: count }).map((_, i) => {
                      const col = i % cols;
                      const row = Math.floor(i / cols);
                      const bgX = cols > 1 ? (col / (cols - 1)) * 100 : 50;
                      const bgY = rows > 1 ? (row / (rows - 1)) * 100 : 50;
                      return (
                        <div
                          key={i}
                          className="aspect-square rounded border bg-muted/30"
                          style={{
                            backgroundImage: `url(${config.fragmentImageUrl})`,
                            backgroundSize: `${cols * 100}% ${rows * 100}%`,
                            backgroundPosition: `${bgX}% ${bgY}%`,
                            backgroundRepeat: "no-repeat",
                          }}
                          title={`碎片 ${i + 1}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

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
              {/* 🔧 2026-05-14：未建道具時、CTA 直接連到道具管理頁、解決「找不到綁定」 */}
              {!hasItemsList && config.demoMode !== true && (
                <div className="flex items-start justify-between gap-3 p-3 mb-3 rounded-lg border-2 border-amber-500/40 bg-amber-500/10">
                  <div className="flex items-start gap-2 flex-1">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                    <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                      <p className="font-semibold">尚未建立任何道具、無法綁定碎片</p>
                      <p>玩家需透過道具系統取得碎片。請先到「道具管理」建立道具、或開啟下方「示範模式」。</p>
                    </div>
                  </div>
                  {gameId && gameId !== "new" && (
                    <a
                      href={`/admin/games/${gameId}/items`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
                      data-testid="link-go-to-items"
                    >
                      <Package className="w-3 h-3" />
                      去道具管理
                    </a>
                  )}
                </div>
              )}
              <div className="space-y-2">
                {fragments.map((fragment, i) => (
                  <div key={fragment.id || i} className="bg-background border rounded-lg p-2 space-y-2">
                    <div className="flex gap-2 items-center">
                      <div className="flex-shrink-0 w-16 text-center">
                        <Badge variant="outline" className="text-xs">碎片 {i + 1}</Badge>
                      </div>
                      {/* 🆕 2026-05-13 P2-5：圖片模式不顯示 value Input（沒用、value 無意義）*/}
                      {config.fragmentSource !== "image" && (
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
                      )}
                      <Input
                        value={fragment.label || ""}
                        onChange={(e) => {
                          const next = [...fragments];
                          next[i] = { ...next[i], label: e.target.value };
                          updateField("fragments", next);
                        }}
                        placeholder={config.fragmentSource === "image" ? "（選填）這塊的提示" : "碎片標籤"}
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
                  // 🆕 2026-05-12 #2: 傳 allPages、讓下拉顯示「#N · 對應 page 名稱」
                  allPages={allPages}
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
