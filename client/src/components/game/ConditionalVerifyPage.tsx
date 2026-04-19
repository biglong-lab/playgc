import { useState, useEffect, useMemo } from "react";
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

export default function ConditionalVerifyPage({
  config,
  onComplete,
  variables,
  inventory = [],
  score = 0,
  visitedLocations = [],
}: ConditionalVerifyPageProps) {
  const { toast } = useToast();
  const [conditionResults, setConditionResults] = useState<boolean[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [allPassed, setAllPassed] = useState(false);
  const [hasShownToast, setHasShownToast] = useState(false);

  const [inputCode, setInputCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  const fragments = useMemo(() => normalizeFragments(config.fragments), [config.fragments]);
  const isFragmentMode = fragments.length > 0;
  // 示範模式：所有 fragment 都沒綁 sourceItemId（模組範本使用字串陣列的情境）
  // 此時視為「劇情展示」，所有碎片預設已收集，讓玩家能順利通關
  const isDemoMode = isFragmentMode && fragments.every((f) => !f.sourceItemId);
  const targetCode = config.targetCode || fragments.map(f => f.value).join('');
  const verificationMode = config.verificationMode || 'order_matters';

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

      if (showToast && !hasShownToast) {
        setHasShownToast(true);
        if (passed) {
          toast({
            title: config.successMessage || "條件達成!",
            description: config.onSuccess?.message || "你已滿足所有條件",
          });
        }
      } else if (showToast && hasShownToast) {
        if (passed) {
          toast({
            title: config.successMessage || "條件達成!",
            description: config.onSuccess?.message || "你已滿足所有條件",
          });
        } else {
          toast({
            title: config.failureMessage || "條件未達成",
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
    toast({
      title: config.successMessage || "解鎖成功!",
      description: config.onSuccess?.message || "你成功組合了正確的密碼",
    });
  };

  const handleContinue = () => {
    if (allPassed) {
      const reward: { points?: number; items?: string[] } = {
        points: config.onSuccess?.points ?? config.rewardPoints ?? 10,
      };
      if (config.onSuccess?.grantItem) {
        reward.items = [config.onSuccess.grantItem];
      }
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
                <Badge variant={allFragmentsCollected ? "default" : "secondary"}>
                  {collectedFragments.length} / {fragments.length}
                </Badge>
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {fragments.map((fragment, index) => {
                  // 示範模式全部已收集；正式模式需綁 sourceItemId 且 inventory 有此道具
                  const isCollected = isDemoMode
                    ? true
                    : fragment.sourceItemId != null &&
                      fragment.sourceItemId !== "" &&
                      inventorySet.has(String(fragment.sourceItemId));
                  return (
                    <div
                      key={fragment.id || index}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center border-2 transition-all ${
                        isCollected 
                          ? "bg-primary/20 border-primary text-primary" 
                          : "bg-muted border-dashed border-muted-foreground/30 text-muted-foreground"
                      }`}
                      data-testid={`fragment-slot-${index}`}
                    >
                      {isCollected ? (
                        <>
                          <span className="text-xl font-mono font-bold">{fragment.value}</span>
                          <span className="text-[10px] mt-1 opacity-70">#{index + 1}</span>
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
            </div>

            {verificationMode !== 'all_collected' && !isDemoMode && (
              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">輸入密碼組合</label>
                <Input
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.toUpperCase());
                    setCodeError(false);
                  }}
                  placeholder={config.fragmentType === 'numbers' ? "輸入數字密碼" : "輸入密碼"}
                  className={`text-center font-mono text-xl tracking-widest ${codeError ? 'border-destructive' : ''}`}
                  maxLength={fragments.reduce((sum, f) => sum + (f.value?.length || 1), 0)}
                  data-testid="input-fragment-code"
                />
                {verificationMode === 'order_independent' && (
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    提示：順序不重要，只需輸入所有碎片
                  </p>
                )}
              </div>
            )}

            {!allPassed && !allFragmentsCollected && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
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
                className="w-full gap-2"
                disabled={
                  !isDemoMode &&
                  verificationMode !== 'all_collected' &&
                  !inputCode.trim()
                }
                data-testid="button-verify-code"
              >
                <Puzzle className="w-4 h-4" />
                {verificationMode === 'all_collected' ? '確認收集完成' : '驗證密碼'}
              </Button>
            ) : (
              <Button
                onClick={handleContinue}
                className="w-full gap-2"
                data-testid="button-continue-fragment"
              >
                <CheckCircle2 className="w-4 h-4" />
                繼續
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
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
