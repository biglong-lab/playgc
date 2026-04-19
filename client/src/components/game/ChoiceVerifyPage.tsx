import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Check, X, ChevronRight } from "lucide-react";
import type { ChoiceVerifyConfig } from "@shared/schema";

interface ChoiceVerifyPageProps {
  config: ChoiceVerifyConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

export default function ChoiceVerifyPage({ config, onComplete }: ChoiceVerifyPageProps) {
  const { toast } = useToast();
  const isQuizMode = !!(config?.questions && config.questions.length > 0);
  const questions = config?.questions ?? [];
  // questionOrder：本輪要做的題目「原始 index」清單
  // 首次是 0..n-1；未過關重考時只剩答錯題
  const [questionOrder, setQuestionOrder] = useState<number[]>(() =>
    isQuizMode ? questions.map((_, i) => i) : [],
  );
  const [orderCursor, setOrderCursor] = useState(0);
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [retryRound, setRetryRound] = useState(0);
  // 防 rage-click：submit 連點或 option + submit 的 race → 避免多次 onComplete
  const finishedRef = useRef(false);

  const currentQuestionIndex = questionOrder[orderCursor] ?? 0;
  const currentQuestion = isQuizMode ? questions[currentQuestionIndex] : null;
  const passingScore = config?.passingScore ?? 0.6;
  const legacyOptions = config?.options ?? [];
  const isLastInOrder = orderCursor >= questionOrder.length - 1;

  const handleOptionClick = (index: number) => {
    if (isSubmitted || showResult) return;
    setSelectedOption(index);
  };

  const handleNextQuestion = () => {
    if (selectedOption === null) return;

    const newAnswers = new Map(answers);
    newAnswers.set(currentQuestionIndex, selectedOption);
    setAnswers(newAnswers);

    if (!isLastInOrder) {
      setOrderCursor((c) => c + 1);
      setSelectedOption(null);
      return;
    }

    // 走到 order 最後一題 → 計分（以全部 questions 為分母）
    let correctCount = 0;
    newAnswers.forEach((answer, qIndex) => {
      if (questions[qIndex] && answer === questions[qIndex].correctAnswer) {
        correctCount++;
      }
    });

    const score = correctCount / questions.length;
    const passed = score >= passingScore;

    setShowResult(true);
    setIsSubmitted(true);

    if (passed) {
      toast({
        title: "測驗通過!",
        description: config.onSuccess?.message || `答對 ${correctCount}/${questions.length} 題`,
      });
      setTimeout(() => {
        const items = config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : undefined;
        const rewardPerQ = config.rewardPerQuestion ?? 10;
        const totalPoints = config.onSuccess?.points ?? correctCount * rewardPerQ;
        onComplete({ points: totalPoints, items }, config.nextPageId);
      }, 2000);
    } else {
      // 找出答錯題原始 index（保留答對題的答案，避免重做）
      const wrongIndices: number[] = [];
      questions.forEach((q, idx) => {
        if (newAnswers.get(idx) !== q.correctAnswer) wrongIndices.push(idx);
      });

      toast({
        title: "測驗未通過",
        description: `答對 ${correctCount}/${questions.length} 題，將只重考答錯的 ${wrongIndices.length} 題`,
        variant: "destructive",
      });
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate([40, 60, 40]); } catch { /* noop */ }
      }
      setTimeout(() => {
        setQuestionOrder(wrongIndices);
        setOrderCursor(0);
        setSelectedOption(null);
        setIsSubmitted(false);
        setShowResult(false);
        setRetryRound((r) => r + 1);
      }, 2500);
    }
  };

  const handleLegacySubmit = () => {
    if (selectedOption === null) return;

    setIsSubmitted(true);

    const correctIndices = legacyOptions
      .map((opt, idx) => (opt.correct ? idx : -1))
      .filter(idx => idx !== -1);

    const isMatch = correctIndices.includes(selectedOption);

    if (isMatch) {
      toast({
        title: "答對了!",
        description: "做得好!",
      });
      setTimeout(() => {
        const selected = legacyOptions[selectedOption];
        onComplete({ points: 10 }, selected?.nextPageId);
      }, 1500);
    } else {
      toast({
        title: "答案不正確",
        description: "請再試一次",
        variant: "destructive",
      });
      setTimeout(() => {
        setIsSubmitted(false);
        setSelectedOption(null);
      }, 1500);
    }
  };

  const getQuizOptionStyle = (index: number) => {
    if (showResult) {
      const isCorrect = currentQuestion?.correctAnswer === index;
      const isSelected = answers.get(currentQuestionIndex) === index;
      if (isCorrect) return "border-success bg-success/10";
      if (isSelected && !isCorrect) return "border-destructive bg-destructive/10";
      return "border-border opacity-50";
    }
    return selectedOption === index
      ? "border-primary bg-primary/10"
      : "border-border hover:border-primary/50";
  };

  const getLegacyOptionStyle = (index: number) => {
    if (!isSubmitted) {
      return selectedOption === index
        ? "border-primary bg-primary/10"
        : "border-border hover:border-primary/50";
    }
    const option = legacyOptions[index];
    if (option?.correct) return "border-success bg-success/10";
    if (selectedOption === index) return "border-destructive bg-destructive/10";
    return "border-border opacity-50";
  };

  if (!isQuizMode && legacyOptions.length === 0) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">尚未設定選項</p>
            <Button onClick={() => onComplete()} className="mt-4">
              繼續
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isQuizMode && currentQuestion) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-bold">
                {config?.title || "知識測驗"}
              </h2>
              <div className="flex items-center gap-2">
                {retryRound > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 font-medium">
                    重考 #{retryRound}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">
                  第 {currentQuestionIndex + 1} 題（本輪 {orderCursor + 1}/{questionOrder.length}）
                </span>
              </div>
            </div>

            <div className="w-full bg-muted rounded-full h-2 mb-6">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${((orderCursor + 1) / Math.max(1, questionOrder.length)) * 100}%` }}
              />
            </div>

            <p className="text-base mb-6">{currentQuestion.question}</p>

            <div className="space-y-3 mb-6">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionClick(index)}
                  disabled={showResult}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${getQuizOptionStyle(index)}`}
                  data-testid={`option-${index}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedOption === index ? "border-primary bg-primary" : "border-muted-foreground"
                  }`}>
                    {selectedOption === index && (
                      <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <span className="flex-1">{option}</span>
                  {showResult && currentQuestion.correctAnswer === index && (
                    <Check className="w-5 h-5 text-success" />
                  )}
                  {showResult && selectedOption === index && currentQuestion.correctAnswer !== index && (
                    <X className="w-5 h-5 text-destructive" />
                  )}
                </button>
              ))}
            </div>

            <Button
              onClick={handleNextQuestion}
              disabled={selectedOption === null || showResult}
              className="w-full gap-2"
              data-testid="button-next-question"
            >
              {!isLastInOrder ? (
                <>下一題 <ChevronRight className="w-4 h-4" /></>
              ) : (
                "提交答案"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <h2 className="text-xl font-display font-bold mb-2 text-center">
            {config?.question ?? "請選擇答案"}
          </h2>

          <div className="space-y-3 mb-6">
            {legacyOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => handleOptionClick(index)}
                disabled={isSubmitted}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${getLegacyOptionStyle(index)}`}
                data-testid={`option-${index}`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedOption === index ? "border-primary bg-primary" : "border-muted-foreground"
                }`}>
                  {selectedOption === index && (
                    <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                  )}
                </div>
                <span className="flex-1">{option.text}</span>
                {isSubmitted && (
                  option.correct ? (
                    <Check className="w-5 h-5 text-success" />
                  ) : selectedOption === index ? (
                    <X className="w-5 h-5 text-destructive" />
                  ) : null
                )}
              </button>
            ))}
          </div>

          <Button
            onClick={handleLegacySubmit}
            disabled={selectedOption === null || isSubmitted}
            className="w-full"
            data-testid="button-submit-choice"
          >
            確認選擇
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
