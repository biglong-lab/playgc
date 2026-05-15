import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { pickVariant } from "@/lib/variant-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Package, ChevronRight, AlertTriangle, Puzzle, Lock, Unlock } from "lucide-react";

interface FragmentConfig {
  id: string;
  label: string;
  value: string;
  /** 可能為 number（舊 seed 資料）或 string（新 schema） */
  sourceItemId?: string | number;
  order?: number;
}

// 對齊 shared/schema/games.ts 的 FragmentCollectionConfig.conditions 型別
// itemId / locationId 用 string | number 相容舊 seed 資料
interface Condition {
  type: "has_item" | "has_points" | "visited_location";
  itemId?: string | number;
  minPoints?: number;
  locationId?: string | number;
  description?: string;
}

interface ConditionalVerifyConfig {
  title?: string;
  instruction?: string;
  description?: string;

  fragmentType?: 'numbers' | 'letters' | 'custom';
  fragmentCount?: number;
  fragments?: FragmentConfig[];
  targetCode?: string;
  verificationMode?: 'order_matters' | 'order_independent' | 'all_collected';
  // 🆕 2026-05-13 P2-5：碎片圖切割
  fragmentSource?: 'text' | 'image';
  fragmentImageUrl?: string;

  conditions?: Condition[];
  allRequired?: boolean;
  successMessage?: string;
  failureMessage?: string;
  onSuccess?: {
    grantItem?: string;
    message?: string;
    points?: number;
    unlockContent?: string;
  };
  nextPageId?: string;
  rewardPoints?: number;
  /** 示範模式：純劇情展示，不要求實際持有道具 */
  demoMode?: boolean;
}

interface ConditionalVerifyPageProps {
  config: ConditionalVerifyConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, unknown>;
  onVariableUpdate: (key: string, value: unknown) => void;
  inventory?: string[];
  score?: number;
  visitedLocations?: string[];
  // 🎨 P2: 變體池
  variantPool?: unknown;
}

/**
 * 相容舊版 fragments 為字串陣列 `["碎片A", "碎片B"]` 的模組範本。
 * 自動轉為 FragmentConfig 物件陣列（無 sourceItemId → 示範模式，不要求真實道具）。
 */
function normalizeFragments(raw: unknown): FragmentConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    if (typeof item === "string") {
      return {
        id: `demo-${i + 1}`,
        label: item,
        value: String(i + 1),
        order: i + 1,
        // 無 sourceItemId → 示範模式（見下方 isDemoMode）
      };
    }
    // 物件格式直接用，補齊缺少的欄位
    const obj = item as Partial<FragmentConfig>;
    return {
      id: obj.id || `f-${i + 1}`,
      label: obj.label || `碎片 ${i + 1}`,
      value: obj.value ?? String(i + 1),
      sourceItemId: obj.sourceItemId,
      order: obj.order ?? i + 1,
    };
  });
}

// 穩定空陣列參考，避免預設值每次 render 產生新陣列觸發 useEffect 無窮迴圈
const EMPTY_STRING_ARRAY: readonly string[] = Object.freeze([]);

/**
 * 依碎片數計算 grid (cols × rows)
 * 2026-05-13 P2-5：與 ConditionalVerifyEditor.calcFragmentGrid 保持一致
 */
function calcFragmentGridClient(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n === 3) return { cols: 3, rows: 1 };
  if (n === 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 8) return { cols: 4, rows: 2 };
  if (n === 9) return { cols: 3, rows: 3 };
  return { cols: 5, rows: 2 };
}

export default function ConditionalVerifyPage({
  config,
  onComplete,
  variables,
  inventory = EMPTY_STRING_ARRAY as string[],
  score = 0,
  visitedLocations = EMPTY_STRING_ARRAY as string[],
  variantPool,
}: ConditionalVerifyPageProps) {
  const { toast } = useToast();
  const [conditionResults, setConditionResults] = useState<boolean[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [allPassed, setAllPassed] = useState(false);
  const [hasShownToast, setHasShownToast] = useState(false);

  const [inputCode, setInputCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  // 🆕 2026-05-13 P2-5：圖片載入失敗偵測（fallback 到文字模式）
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  useEffect(() => {
    if (config.fragmentSource !== "image" || !config.fragmentImageUrl) {
      setImageLoadFailed(false);
      return;
    }
    setImageLoadFailed(false);
    const img = new Image();
    img.onload = () => setImageLoadFailed(false);
    img.onerror = () => setImageLoadFailed(true);
    img.src = config.fragmentImageUrl;
  }, [config.fragmentSource, config.fragmentImageUrl]);

  const fragments = useMemo(() => normalizeFragments(config.fragments), [config.fragments]);
  const isFragmentMode = fragments.length > 0;
  // 🆕 2026-05-13 P2-5：圖片切割模式（圖片載入失敗 fallback 文字）
  const isImageFragmentMode =
    config.fragmentSource === "image" &&
    !!config.fragmentImageUrl &&
    !imageLoadFailed;
  // 示範模式：由 admin 明確設定 config.demoMode，或向後相容
  // 「所有 fragment 都沒綁 sourceItemId」舊資料（模組範本字串陣列）
  const isDemoMode =
    isFragmentMode &&
    (config.demoMode === true || fragments.every((f) => !f.sourceItemId));
  const targetCode = config.targetCode || fragments.map(f => f.value).join('');
  // 🆕 image 模式強制 all_collected（玩家拼出整圖即通過、不需輸入密碼）
  const verificationMode = isImageFragmentMode
    ? 'all_collected'
    : (config.verificationMode || 'order_matters');

  // inventory 可能混有 string / number（舊 seed 資料），統一轉字串集合做比對
  const inventorySet = useMemo(
    () => new Set(inventory.map((id) => String(id))),
    [inventory],
  );
  const visitedSet = useMemo(
    () => new Set(visitedLocations.map((id) => String(id))),
    [visitedLocations],
  );

  const collectedFragments = useMemo(() => {
    if (!isFragmentMode) return [];
    // 示範模式（模組範本字串陣列）：所有 fragment 都預設已收集
    if (isDemoMode) return fragments;
    // 正式模式：sourceItemId 未設時預設未收集；比對 String() 轉相容 number/string
    return fragments.filter((fragment) =>
      fragment.sourceItemId != null &&
      fragment.sourceItemId !== "" &&
      inventorySet.has(String(fragment.sourceItemId))
    );
  }, [fragments, inventorySet, isFragmentMode, isDemoMode]);

  const allFragmentsCollected = collectedFragments.length === fragments.length;

  const checkCondition = (condition: Condition): boolean => {
    switch (condition.type) {
      case "has_item":
        // 相容舊資料 itemId 為 number 的情況，雙方 String() 後比對
        return condition.itemId != null && condition.itemId !== "" &&
          inventorySet.has(String(condition.itemId));
      case "has_points":
        return score >= (condition.minPoints ?? 0);
      case "visited_location":
        return condition.locationId != null && condition.locationId !== "" &&
          visitedSet.has(String(condition.locationId));
      default:
        return false;
    }
  };

  const verifyConditions = (showToast: boolean = false) => {
    if (!config.conditions || config.conditions.length === 0) return;
    
    setIsChecking(true);

    setTimeout(() => {
      const results = config.conditions!.map(checkCondition);
      setConditionResults(results);

      const passed = config.allRequired !== false 
        ? results.every(r => r) 
        : results.some(r => r);

      setAllPassed(passed);
      setIsChecking(false);

      // 🎨 P2: 從變體池抽訊息
      const successTitle = pickVariant(variantPool, "success", config.successMessage || "條件達成!");
      const successDesc = pickVariant(variantPool, "hint", config.onSuccess?.message || "你已滿足所有條件");
      const failTitle = pickVariant(variantPool, "fail", config.failureMessage || "條件未達成");

      if (showToast && !hasShownToast) {
        setHasShownToast(true);
        if (passed) {
          toast({ title: successTitle, description: successDesc });
        }
      } else if (showToast && hasShownToast) {
        if (passed) {
          toast({ title: successTitle, description: successDesc });
        } else {
          toast({
            title: failTitle,
            description: "請先完成必要任務",
            variant: "destructive",
          });
        }
      }
    }, 300);
  };

  const verifyFragmentCode = () => {
    setCodeError(false);
    
    if (verificationMode === 'all_collected') {
      if (allFragmentsCollected) {
        handleSuccess();
      } else {
        toast({
          title: "碎片不足",
          description: "請先收集所有碎片",
          variant: "destructive",
        });
      }
      return;
    }

    const normalizedInput = inputCode.trim().toUpperCase();
    const normalizedTarget = targetCode.trim().toUpperCase();
    
    let isValid = false;
    
    if (verificationMode === 'order_matters') {
      isValid = normalizedInput === normalizedTarget;
    } else if (verificationMode === 'order_independent') {
      const inputChars = normalizedInput.split('').sort().join('');
      const targetChars = normalizedTarget.split('').sort().join('');
      isValid = inputChars === targetChars;
    }

    if (isValid) {
      handleSuccess();
    } else {
      setCodeError(true);
      toast({
        title: "密碼錯誤",
        description: "請檢查碎片組合順序",
        variant: "destructive",
      });
    }
  };

  const handleSuccess = () => {
    setAllPassed(true);
    // 🎨 P2: 從變體池抽成功訊息
    toast({
      title: pickVariant(variantPool, "success", config.successMessage || "解鎖成功!"),
      description: pickVariant(variantPool, "hint", config.onSuccess?.message || "你成功組合了正確的密碼"),
    });
  };

  // 防 rage-click 「繼續」觸發多次 onComplete
  const finishedRef = useRef(false);
  const handleContinue = () => {
    if (allPassed) {
      if (finishedRef.current) return;
      finishedRef.current = true;
      // 🔧 修 bug：RewardsSection 存 rewardItems[] 優先，舊 onSuccess.grantItem 向後相容
      const rsItems = (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
      const reward: { points?: number; items?: string[] } = {
        points: config.rewardPoints ?? config.onSuccess?.points ?? 0,
      };
      const allItems = [
        ...rsItems.filter((x) => !!x),
        ...(config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : []),
      ];
      if (allItems.length > 0) reward.items = allItems;
      onComplete(reward, config.nextPageId);
    } else {
      toast({
        title: "無法繼續",
        description: config.failureMessage || "請先完成所有必要條件",
        variant: "destructive",
      });
    }
  };

  // 條件 mode：初次檢查
  useEffect(() => {
    if (!isFragmentMode && config.conditions && config.conditions.length > 0) {
      verifyConditions(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 條件 mode：玩家取得道具 / 點數 / 造訪地點後重新檢查條件（不彈 toast）
  useEffect(() => {
    if (!isFragmentMode && config.conditions && config.conditions.length > 0) {
      const results = config.conditions.map(checkCondition);
      setConditionResults(results);
      const passed = config.allRequired !== false
        ? results.every(r => r)
        : results.some(r => r);
      setAllPassed(passed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory, score, visitedLocations]);

  if (isFragmentMode) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                allPassed ? "bg-success/20" : "bg-primary/20"
              }`}>
                {allPassed ? (
                  <Unlock className="w-8 h-8 text-success" />
                ) : (
                  <Puzzle className="w-8 h-8 text-primary" />
                )}
              </div>
            </div>

            <h2 className="text-xl font-display font-bold text-center mb-2">
              {config.title || "碎片收集"}
            </h2>
            
            <p className="text-sm text-muted-foreground text-center mb-6">
              {config.instruction || config.description || "收集所有碎片，組成正確的密碼"}
            </p>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">已收集碎片</span>
                <Badge
                  variant={allFragmentsCollected ? "default" : "secondary"}
                  className={`tabular-nums ${allFragmentsCollected ? "animate-pulse" : ""}`}
                >
                  {collectedFragments.length} / {fragments.length}
                </Badge>
              </div>

              {/* 🆕 進度條（玩家直觀看到收集進度） */}
              <div className="h-1.5 rounded-full bg-muted mb-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    allFragmentsCollected ? "bg-emerald-500" : "bg-primary"
                  }`}
                  style={{ width: `${(collectedFragments.length / Math.max(1, fragments.length)) * 100}%` }}
                />
              </div>

              {(() => {
                // 🆕 2026-05-13 P2-5：圖片切割模式 — CSS background-position 顯示切片
                const isImageMode = config.fragmentSource === "image" && !!config.fragmentImageUrl;
                const count = fragments.length;
                const grid = isImageMode ? calcFragmentGridClient(count) : null;
                const gridCols = grid ? grid.cols : Math.min(4, Math.max(2, count));
                return (
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                  >
                    {fragments.map((fragment, index) => {
                      const isCollected = isDemoMode
                        ? true
                        : fragment.sourceItemId != null &&
                          fragment.sourceItemId !== "" &&
                          inventorySet.has(String(fragment.sourceItemId));

                      if (isImageMode && grid) {
                        const col = index % grid.cols;
                        const row = Math.floor(index / grid.cols);
                        const bgX = grid.cols > 1 ? (col / (grid.cols - 1)) * 100 : 50;
                        const bgY = grid.rows > 1 ? (row / (grid.rows - 1)) * 100 : 50;
                        return (
                          <div
                            key={fragment.id || index}
                            className={`aspect-square rounded-lg overflow-hidden border-2 transition-all relative ${
                              isCollected
                                ? "border-primary shadow-sm"
                                : "border-dashed border-muted-foreground/30"
                            }`}
                            style={{
                              backgroundImage: `url(${config.fragmentImageUrl})`,
                              backgroundSize: `${grid.cols * 100}% ${grid.rows * 100}%`,
                              backgroundPosition: `${bgX}% ${bgY}%`,
                              backgroundRepeat: "no-repeat",
                              filter: isCollected ? "none" : "grayscale(100%) opacity(0.3)",
                            }}
                            data-testid={`fragment-slot-${index}`}
                          >
                            {!isCollected && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Lock className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <span className="absolute bottom-1 right-1 text-[10px] bg-background/80 px-1 rounded">
                              {index + 1}
                            </span>
                          </div>
                        );
                      }

                      // 文字模式（既有）
                      return (
                        <div
                          key={fragment.id || index}
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center border-2 transition-all ${
                            isCollected
                              ? "bg-primary/20 border-primary text-primary scale-100 shadow-sm"
                              : "bg-muted border-dashed border-muted-foreground/30 text-muted-foreground scale-95"
                          }`}
                          data-testid={`fragment-slot-${index}`}
                        >
                          {isCollected ? (
                            <>
                              <span className="text-xl font-mono font-bold">{fragment.value}</span>
                              <span className="text-[10px] mt-1 opacity-70 tabular-nums">#{index + 1}</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4" />
                              <span className="text-[10px] mt-1">?</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {verificationMode !== 'all_collected' && !isDemoMode && (
              <div className="mb-6">
                <label htmlFor="fragment-code-input" className="text-sm font-medium mb-2 block">
                  輸入密碼組合
                </label>
                <Input
                  id="fragment-code-input"
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.toUpperCase());
                    setCodeError(false);
                  }}
                  placeholder={config.fragmentType === 'numbers' ? "輸入數字密碼" : "輸入密碼"}
                  className={`text-center font-mono text-xl tracking-widest ${codeError ? 'border-destructive' : ''}`}
                  maxLength={fragments.reduce((sum, f) => sum + (f.value?.length || 1), 0)}
                  data-testid="input-fragment-code"
                  aria-label="輸入密碼組合"
                  aria-invalid={codeError}
                  aria-describedby={verificationMode === 'order_independent' ? "fragment-code-hint" : undefined}
                />
                {verificationMode === 'order_independent' && (
                  <p id="fragment-code-hint" className="text-xs text-muted-foreground mt-1 text-center">
                    提示：順序不重要，只需輸入所有碎片
                  </p>
                )}
              </div>
            )}

            {!allPassed && !allFragmentsCollected && (
              <div
                className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-amber-500">
                    你還沒有收集完所有碎片
                  </p>
                </div>
              </div>
            )}

            {!allPassed ? (
              <Button
                onClick={
                  isDemoMode || verificationMode === 'all_collected'
                    ? handleSuccess
                    : verifyFragmentCode
                }
                className="w-full gap-2 transition-transform active:scale-[0.97]"
                disabled={
                  !isDemoMode &&
                  verificationMode !== 'all_collected' &&
                  !inputCode.trim()
                }
                data-testid="button-verify-code"
                aria-label={verificationMode === 'all_collected' ? '確認碎片已收集完成' : '驗證輸入的密碼組合'}
              >
                <Puzzle className="w-4 h-4" aria-hidden="true" />
                {verificationMode === 'all_collected' ? '確認收集完成' : '驗證密碼'}
              </Button>
            ) : (
              <Button
                onClick={handleContinue}
                className="w-full gap-2 transition-transform active:scale-[0.97]"
                data-testid="button-continue-fragment"
                aria-label="碎片驗證通過、繼續下一步"
              >
                <CheckCircle2 className="w-4 h-4 animate-[pulse_2s_ease-in-out_infinite]" aria-hidden="true" />
                繼續
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="min-h-full flex flex-col items-center justify-center p-6"
    >
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-center mb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              allPassed ? "bg-success/20" : "bg-muted"
            }`}>
              {allPassed ? (
                <CheckCircle2 className="w-8 h-8 text-success" />
              ) : (
                <Package className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
          </div>

          <h2 className="text-xl font-display font-bold text-center mb-6">
            {config.title || "條件檢查"}
          </h2>

          <div className="space-y-3 mb-6">
            {(config.conditions || []).map((condition, index) => {
              const passed = conditionResults[index];
              const Icon = passed ? CheckCircle2 : XCircle;

              return (
                <div 
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    passed 
                      ? "bg-success/10 border-success/30" 
                      : "bg-muted/50 border-border"
                  } ${isChecking ? "animate-pulse" : ""}`}
                  data-testid={`condition-check-${index}`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${
                    passed ? "text-success" : "text-muted-foreground"
                  }`} />
                  <span className={`text-sm ${
                    passed ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {condition.description}
                  </span>
                </div>
              );
            })}
          </div>

          {!allPassed && conditionResults.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-500">
                  {config.failureMessage || "你還沒有收集完整所有必要物品"}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={() => verifyConditions(true)}
              variant="outline"
              className="flex-1"
              disabled={isChecking}
              data-testid="button-recheck"
            >
              重新檢查
            </Button>
            <Button
              onClick={handleContinue}
              className="flex-1 gap-2"
              disabled={!allPassed || isChecking}
              data-testid="button-continue"
            >
              繼續
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
