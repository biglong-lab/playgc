import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, HelpCircle, RefreshCw, History, BookOpen } from "lucide-react";
import type { TextVerifyConfig } from "@shared/schema";

interface TextVerifyPageProps {
  config: TextVerifyConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: any) => void;
}

export default function TextVerifyPage({ config, onComplete }: TextVerifyPageProps) {
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
  const hasHints = config.hints && config.hints.length > 0;
  const currentHint = showHint && hasHints ? config.hints![Math.min(attempts, config.hints!.length - 1)] : null;
  const inputType = config.inputType || "text";

  const getGradedFeedback = (userAnswer: string, correctAnswers: string[]): { level: "close" | "medium" | "far"; message: string } => {
    if (!config.gradedFeedback) {
      return { level: "far", message: "答案不正確" };
    }

    const normalizedUser = userAnswer.toLowerCase().trim();
    
    for (const correct of correctAnswers) {
      const normalizedCorrect = correct.toLowerCase().trim();
      
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

  const checkAnswer = () => {
    if (!answer.trim()) return;

    setIsAnimating(true);
    
    const normalizedAnswer = config.caseSensitive 
      ? answer.trim() 
      : answer.trim().toLowerCase();

    const answersArray = [...(config.answers || [])];
    if (config.correctAnswer) {
      answersArray.push(config.correctAnswer);
    }
    
    const isMatch = answersArray.some(validAnswer => {
      const normalizedValid = config.caseSensitive 
        ? validAnswer 
        : validAnswer.toLowerCase();
      return normalizedAnswer === normalizedValid;
    });

    if (config.showAttemptHistory) {
      setAttemptHistory(prev => [...prev, answer]);
    }

    setTimeout(() => {
      setIsAnimating(false);
      
      if (isMatch) {
        setIsCorrect(true);
        toast({
          title: config.onSuccess?.message || config.successMessage || "答對了!",
          description: "做得好!",
        });
        
        if (config.showExplanation && config.explanation) {
          setShowExplanation(true);
          setTimeout(() => {
            const items = config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : undefined;
            onComplete({ points: 10, items }, config.nextPageId);
          }, 3000);
        } else {
          setTimeout(() => {
            const items = config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : undefined;
            onComplete({ points: 10, items }, config.nextPageId);
          }, 1500);
        }
      } else {
        setIsCorrect(false);
        setAttempts(prev => prev + 1);
        
        const feedback = getGradedFeedback(answer, answersArray);
        
        if (attempts + 1 >= maxAttempts) {
          toast({
            title: "答錯太多次",
            description: config.failureMessage || "已達最大嘗試次數",
            variant: "destructive",
          });
          
          if (config.showExplanation && config.explanation) {
            setShowExplanation(true);
            setTimeout(() => {
              onComplete({ points: 0 }, config.nextPageId);
            }, 3000);
          } else {
            setTimeout(() => {
              onComplete({ points: 0 }, config.nextPageId);
            }, 2000);
          }
        } else {
          toast({
            title: feedback.message,
            description: `還剩 ${maxAttempts - attempts - 1} 次機會`,
            variant: "destructive",
          });
          setTimeout(() => setIsCorrect(null), 1000);
        }
      }
    }, 500);
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      <Card className={`w-full max-w-md transition-all duration-300 ${
        isAnimating ? "scale-95" : ""
      } ${
        isCorrect === true ? "ring-2 ring-success" : 
        isCorrect === false ? "ring-2 ring-destructive" : ""
      }`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="outline" className="font-number">
              剩餘次數: {maxAttempts - attempts}
            </Badge>
            <div className="flex gap-1">
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
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={inputType === "number" ? "輸入數字..." : "輸入你的答案..."}
              onKeyDown={(e) => e.key === "Enter" && checkAnswer()}
              disabled={isCorrect !== null}
              className="text-center text-lg h-12"
              inputMode={inputType === "number" ? "numeric" : "text"}
              data-testid="input-answer"
            />

            <div className="flex gap-2">
              <Button
                onClick={() => setAnswer("")}
                variant="outline"
                className="flex-1 gap-2"
                disabled={isCorrect !== null}
                data-testid="button-clear"
              >
                <RefreshCw className="w-4 h-4" />
                清除
              </Button>
              <Button
                onClick={checkAnswer}
                className="flex-1 gap-2"
                disabled={!answer.trim() || isCorrect !== null}
                data-testid="button-submit-answer"
              >
                {isCorrect === true ? (
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
