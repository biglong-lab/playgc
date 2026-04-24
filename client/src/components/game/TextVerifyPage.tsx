import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Check, X, HelpCircle, RefreshCw, History, BookOpen, Loader2 } from "lucide-react";
import type { TextVerifyConfig } from "@shared/schema";
import { normalizeAnswer, NO_AUTO_INPUT_PROPS } from "@/lib/gameVerification";

interface TextVerifyPageProps {
  config: TextVerifyConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  variables: Record<string, unknown>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

interface AiScoreResponse {
  score: number;
  isCorrect: boolean;
  feedback: string;
  fallback?: boolean;
}

export default function TextVerifyPage({ config, onComplete, gameId }: TextVerifyPageProps) {
  const { toast } = useToast();
  const [answer, setAnswer] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [attemptHistory, setAttemptHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const maxAttempts = config.maxAttempts || 5;
  // 支援 hints（複數）和 hint（單數，schema 有這個欄位但原本沒讀）
  const hintList: string[] = (config.hints && config.hints.length > 0)
    ? config.hints
    : (config.hint ? [config.hint] : []);
  const hasHints = hintList.length > 0;
  const currentHint = showHint && hasHints
    ? hintList[Math.min(attempts, hintList.length - 1)]
    : null;
  const inputType = config.inputType || "text";

  // AI 語意評分 mutation
  const aiScoreMutation = useMutation({
    mutationFn: async (userAnswer: string): Promise<AiScoreResponse> => {
      const answersArray = buildAnswersArray();
      const response = await apiRequest("POST", "/api/ai/score-text", {
        question: config.question,
        userAnswer,
        expectedAnswers: answersArray,
        context: config.aiContext,
        passingScore: config.aiPassingScore ?? 70,
        gameId,
      });
      return response.json();
    },
  });

  const buildAnswersArray = (): string[] => {
    const arr = [...(config.answers || [])];
    if (config.correctAnswer) {
      arr.push(config.correctAnswer);
    }
    return arr;
  };

  const getGradedFeedback = (userAnswer: string, correctAnswers: string[]): { level: "close" | "medium" | "far"; message: string } => {
    if (!config.gradedFeedback) {
      return { level: "far", message: "答案不正確" };
    }

    const normalizedUser = normalizeAnswer(userAnswer, !!config.caseSensitive);

    for (const correct of correctAnswers) {
      const normalizedCorrect = normalizeAnswer(correct, !!config.caseSensitive);

      if (normalizedUser.length === normalizedCorrect.length) {
        let matchCount = 0;
        for (let i = 0; i < normalizedUser.length; i++) {
          if (normalizedUser[i] === normalizedCorrect[i]) matchCount++;
        }
        const similarity = matchCount / normalizedCorrect.length;

        if (similarity >= 0.8) {
          return { level: "close", message: "非常接近了！再想想！" };
        }
        if (similarity >= 0.5) {
          return { level: "medium", message: "有點接近，繼續努力！" };
        }
      }

      if (normalizedCorrect.includes(normalizedUser) || normalizedUser.includes(normalizedCorrect)) {
        return { level: "medium", message: "方向對了，但不完全正確" };
      }
    }

    return { level: "far", message: "答案不正確，再試試！" };
  };

  // 防重複 onComplete（AI 評分 race / 使用者在動畫中 mash Enter）
  const finishedRef = useRef(false);

  const handleCorrect = (feedbackMessage?: string) => {
    if (finishedRef.current) return;
    setIsCorrect(true);
    toast({
      title: feedbackMessage || config.onSuccess?.message || config.successMessage || "答對了！",
      description: "做得好！",
    });

    const fireOnComplete = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      // 🔧 修 bug：RewardsSection 存 rewardItems[] 優先，舊 onSuccess.grantItem 向後相容
      const rsItems = (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
      const allItems = [
        ...rsItems.filter((x) => !!x),
        ...(config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : []),
      ];
      onComplete(
        {
          points: config.rewardPoints ?? config.onSuccess?.points ?? 10,
          items: allItems.length > 0 ? allItems : undefined,
        },
        config.nextPageId,
      );
    };

    if (config.showExplanation && config.explanation) {
      setShowExplanation(true);
      setTimeout(fireOnComplete, 3000);
    } else {
      setTimeout(fireOnComplete, 1500);
    }
  };

  const handleIncorrect = (feedbackMessage?: string) => {
    if (finishedRef.current) return;
    setIsCorrect(false);
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (newAttempts >= maxAttempts) {
      toast({
        title: "答錯太多次",
        description: feedbackMessage || config.failureMessage || "已達最大嘗試次數",
        variant: "destructive",
      });

      const fireOnComplete = () => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        onComplete({ points: 0 }, config.nextPageId);
      };

      if (config.showExplanation && config.explanation) {
        setShowExplanation(true);
        setTimeout(fireOnComplete, 3000);
      } else {
        setTimeout(fireOnComplete, 2000);
      }
    } else {
      const answersArray = buildAnswersArray();
      const feedback = feedbackMessage || getGradedFeedback(answer, answersArray).message;
      toast({
        title: feedback,
        description: `還剩 ${maxAttempts - newAttempts} 次機會`,
        variant: "destructive",
      });
      // 觸覺回饋 + 震動動畫（提升錯誤感知）
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate([40, 60, 40]); } catch { /* noop */ }
      }
      // 縮短重試等待（1s → 400ms），並保留 isAnimating 結束
      setTimeout(() => setIsCorrect(null), 400);
    }
  };

  const checkAnswer = async () => {
    // 空答案不靜默 return，給提示
    if (!answer.trim()) {
      toast({
        title: "請輸入答案",
        description: "答案不能為空",
        variant: "destructive",
      });
      return;
    }

    setIsAnimating(true);

    const normalizedAnswer = normalizeAnswer(answer, !!config.caseSensitive);

    const answersArray = buildAnswersArray();

    // 精確匹配檢查（所有模式都先做）— 用統一的 normalizeAnswer
    const isExactMatch = answersArray.some((validAnswer) =>
      normalizedAnswer === normalizeAnswer(validAnswer, !!config.caseSensitive),
    );

    if (config.showAttemptHistory) {
      setAttemptHistory((prev) => [...prev, answer]);
    }

    // 精確匹配成功 → 直接通過（不呼叫 AI，省費用）
    if (isExactMatch) {
      setTimeout(() => {
        setIsAnimating(false);
        handleCorrect();
      }, 500);
      return;
    }

    // AI 語意評分模式
    if (config.aiScoring) {
      try {
        const result = await aiScoreMutation.mutateAsync(answer.trim());

        setIsAnimating(false);

        // AI fallback（服務不可用）→ 視為需重試，不算玩家答錯
        if (result.fallback) {
          toast({
            title: "評分服務暫時無法使用",
            description: "請稍後再試，本次不扣除嘗試次數",
            variant: "destructive",
          });
          return;
        }

        if (result.isCorrect) {
          handleCorrect(result.feedback);
        } else {
          handleIncorrect(result.feedback);
        }
      } catch {
        // API 錯誤 → 不扣次數、提示玩家重試（原本會呼叫 handleIncorrect 扣次數，不合理）
        setIsAnimating(false);
        toast({
          title: "評分服務連線失敗",
          description: "請稍後再試，本次不扣除嘗試次數",
          variant: "destructive",
        });
      }
      return;
    }

    // 非 AI 模式 → 原始邏輯
    setTimeout(() => {
      setIsAnimating(false);
      handleIncorrect();
    }, 500);
  };

  const isChecking = aiScoreMutation.isPending || isAnimating;

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      <Card className={`w-full max-w-md transition-all duration-300 ${
        isAnimating ? "scale-95" : ""
      } ${
        isCorrect === true ? "ring-2 ring-success" :
        isCorrect === false ? "ring-2 ring-destructive tv-shake" : ""
      }`}>
        <style>{`
          @keyframes tv-shake-kf {
            0%, 100% { transform: translateX(0); }
            15% { transform: translateX(-8px); }
            30% { transform: translateX(8px); }
            45% { transform: translateX(-6px); }
            60% { transform: translateX(6px); }
            75% { transform: translateX(-3px); }
            90% { transform: translateX(3px); }
          }
          .tv-shake { animation: tv-shake-kf 0.4s ease-in-out; }
        `}</style>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="outline" className="font-number">
              剩餘次數: {maxAttempts - attempts}
            </Badge>
            <div className="flex gap-1">
              {config.aiScoring && (
                <Badge variant="secondary" className="text-xs">
                  AI 評分
                </Badge>
              )}
              {config.showAttemptHistory && attemptHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="gap-1"
                  data-testid="button-show-history"
                >
                  <History className="w-4 h-4" />
                  {attemptHistory.length}
                </Button>
              )}
              {hasHints && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHint(!showHint)}
                  className="gap-1"
                  data-testid="button-show-hint"
                >
                  <HelpCircle className="w-4 h-4" />
                  提示
                </Button>
              )}
            </div>
          </div>

          {config.title && (
            <p className="text-sm text-muted-foreground mb-2 text-center">{config.title}</p>
          )}

          <h2 className="text-xl font-display font-bold mb-6 text-center">
            {config.question}
          </h2>

          {showHistory && attemptHistory.length > 0 && (
            <div className="bg-muted/50 border border-border rounded-lg p-3 mb-4">
              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                <History className="w-4 h-4" />
                嘗試記錄
              </p>
              <div className="flex flex-wrap gap-1">
                {attemptHistory.map((attempt, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {attempt}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {currentHint && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-primary flex items-center gap-2">
                <HelpCircle className="w-4 h-4 flex-shrink-0" />
                {currentHint}
              </p>
            </div>
          )}

          {showExplanation && config.explanation && (
            <div className="bg-accent border border-border rounded-lg p-4 mb-4 animate-slideIn">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                解析
              </p>
              <p className="text-sm text-muted-foreground">{config.explanation}</p>
            </div>
          )}

          <div className="space-y-4">
            <Input
              type={inputType}
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                // 使用者一開始修改 → 立即清錯誤狀態，讓重試不被 disabled 卡住
                if (isCorrect === false) setIsCorrect(null);
              }}
              placeholder={inputType === "number" ? "輸入數字..." : "輸入你的答案..."}
              // IME composing 中不觸發（中日韓輸入法確認選字時按 Enter）
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if ((e.nativeEvent as KeyboardEvent).isComposing) return;
                if (!isChecking) checkAnswer();
              }}
              // 答對或評分中才 disabled；答錯不 disabled，允許立即重試
              disabled={isCorrect === true || isChecking}
              className="text-center text-lg h-12"
              inputMode={inputType === "number" ? "numeric" : "text"}
              {...NO_AUTO_INPUT_PROPS}
              data-testid="input-answer"
            />

            <div className="flex gap-2">
              <Button
                onClick={() => { setAnswer(""); if (isCorrect === false) setIsCorrect(null); }}
                variant="outline"
                className="flex-1 gap-2"
                disabled={isCorrect === true || isChecking}
                data-testid="button-clear"
              >
                <RefreshCw className="w-4 h-4" />
                清除
              </Button>
              <Button
                onClick={checkAnswer}
                className="flex-1 gap-2"
                disabled={!answer.trim() || isCorrect === true || isChecking}
                data-testid="button-submit-answer"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 評分中...
                  </>
                ) : isCorrect === true ? (
                  <>
                    <Check className="w-4 h-4" />
                    正確!
                  </>
                ) : isCorrect === false ? (
                  <>
                    <X className="w-4 h-4" />
                    錯誤
                  </>
                ) : (
                  "確認"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
