// 快問快答 — 全員同步搶答，計時器驅動，L3 持久化
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PopQuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIdx: number;
  timeLimitSec: number;
}

export interface PopQuizConfig {
  title: string;
  questions: PopQuizQuestion[];
}

export interface PlayerAnswer {
  userId: string;
  questionId: string;
  selectedIdx: number;
  answeredAt: number;
}

export interface PopQuizState extends Record<string, unknown> {
  phase: "intro" | "question" | "done";
  currentQuestionIdx: number;
  questionStartedAt: number | null;
  hostUserId: string | null;
  answers: PlayerAnswer[];
}

interface PopQuizProps {
  config: PopQuizConfig;
  state: PopQuizState;
  myUserId: string;
  onStart: () => Promise<void>;
  onAnswer: (questionId: string, selectedIdx: number) => Promise<void>;
  onAdvance: () => Promise<void>;
}

function ScoreCard({ answers, questions, userId }: {
  answers: PlayerAnswer[];
  questions: PopQuizQuestion[];
  userId: string;
}) {
  const myAnswers = answers.filter((a) => a.userId === userId);
  const correct = myAnswers.filter((a) => {
    const q = questions.find((q) => q.id === a.questionId);
    return q && a.selectedIdx === q.correctIdx;
  }).length;
  return (
    <div data-testid="my-score" className="text-center">
      <div className="text-4xl font-bold text-yellow-500">{correct}</div>
      <div className="text-muted-foreground text-sm mt-1">/ {questions.length} 答對</div>
    </div>
  );
}

export default function PopQuiz({ config, state, myUserId, onStart, onAnswer, onAdvance }: PopQuizProps) {
  const { phase, currentQuestionIdx, questionStartedAt, hostUserId, answers } = state;
  const questions = config.questions ?? [];
  const currentQuestion = questions[currentQuestionIdx] ?? null;
  const isHost = hostUserId === myUserId;

  const myAnswerForCurrent = answers.find(
    (a) => a.userId === myUserId && a.questionId === currentQuestion?.id
  );
  const hasAnswered = !!myAnswerForCurrent;

  // 計時器狀態（本地）
  const [timeLeft, setTimeLeft] = useState<number>(currentQuestion?.timeLimitSec ?? 30);
  const advancedRef = useRef(false);

  useEffect(() => {
    if (phase !== "question" || !questionStartedAt || !currentQuestion) return;
    advancedRef.current = false;

    const tick = () => {
      const elapsed = (Date.now() - questionStartedAt) / 1000;
      const remaining = Math.max(0, currentQuestion.timeLimitSec - elapsed);
      setTimeLeft(Math.ceil(remaining));

      if (remaining <= 0 && !advancedRef.current) {
        advancedRef.current = true;
        onAdvance();
      }
    };

    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [phase, questionStartedAt, currentQuestion, onAdvance]);

  // 重置 advancedRef 當題目切換
  useEffect(() => {
    advancedRef.current = false;
    if (currentQuestion) setTimeLeft(currentQuestion.timeLimitSec);
  }, [currentQuestionIdx, currentQuestion]);

  if (phase === "intro") {
    return (
      <Card data-testid="pop-quiz-root">
        <CardContent className="p-8 text-center space-y-6">
          <div className="text-4xl">🧠</div>
          <h2 data-testid="pop-quiz-title" className="text-2xl font-bold">{config.title}</h2>
          <p className="text-muted-foreground">共 {questions.length} 題，限時搶答</p>
          <Button
            data-testid="start-quiz-btn"
            size="lg"
            onClick={onStart}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8"
          >
            開始遊戲 🚀
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <Card data-testid="pop-quiz-done">
        <CardContent className="p-8 space-y-6">
          <div className="text-center">
            <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
            <h2 className="text-2xl font-bold">遊戲結束！</h2>
          </div>
          <ScoreCard answers={answers} questions={questions} userId={myUserId} />

          <div className="space-y-3 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">各題正確率</h3>
            {questions.map((q, idx) => {
              const allForQ = answers.filter((a) => a.questionId === q.id);
              const correctCount = allForQ.filter((a) => a.selectedIdx === q.correctIdx).length;
              const pct = allForQ.length > 0 ? Math.round((correctCount / allForQ.length) * 100) : 0;
              return (
                <div key={q.id} data-testid={`result-row-${idx}`} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">Q{idx + 1}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentQuestion) return null;

  const timerUrgent = timeLeft <= 5;

  return (
    <Card data-testid="pop-quiz-root">
      <CardContent className="p-6 space-y-5">
        {/* 題號 + 計時器 */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" data-testid="question-badge">
            Q{currentQuestionIdx + 1} / {questions.length}
          </Badge>
          <div
            data-testid="quiz-timer"
            className={cn(
              "flex items-center gap-1 font-mono font-bold text-lg",
              timerUrgent ? "text-red-500 animate-pulse" : "text-muted-foreground"
            )}
          >
            <Clock className="w-4 h-4" />
            {timeLeft}s
          </div>
        </div>

        {/* 題目 */}
        <p data-testid="question-prompt" className="text-lg font-semibold leading-relaxed">
          {currentQuestion.prompt}
        </p>

        {/* 選項 */}
        <div className="grid grid-cols-1 gap-3">
          {currentQuestion.options.map((opt, idx) => {
            const isSelected = myAnswerForCurrent?.selectedIdx === idx;
            const isCorrect = idx === currentQuestion.correctIdx;
            let variant: "default" | "outline" = "outline";
            let extra = "";

            if (hasAnswered) {
              if (isCorrect) extra = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700";
              else if (isSelected && !isCorrect) extra = "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 opacity-80";
              else extra = "opacity-40";
            } else if (isSelected) {
              variant = "default";
            }

            return (
              <button
                key={idx}
                data-testid={`option-${idx}`}
                disabled={hasAnswered}
                onClick={() => onAnswer(currentQuestion.id, idx)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium",
                  hasAnswered ? extra : "border-border hover:border-blue-400 hover:bg-blue-50/50",
                  isSelected && !hasAnswered ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "",
                )}
              >
                <span className="mr-2 font-bold text-muted-foreground">{String.fromCharCode(65 + idx)}.</span>
                {opt}
                {hasAnswered && isCorrect && <CheckCircle className="inline w-4 h-4 ml-2 text-green-500" />}
                {hasAnswered && isSelected && !isCorrect && <XCircle className="inline w-4 h-4 ml-2 text-red-500" />}
              </button>
            );
          })}
        </div>

        {/* 作答狀態 */}
        {hasAnswered && (
          <div
            data-testid="answer-submitted"
            className={cn(
              "text-center text-sm font-medium py-2 rounded",
              myAnswerForCurrent.selectedIdx === currentQuestion.correctIdx
                ? "text-green-600"
                : "text-red-500"
            )}
          >
            {myAnswerForCurrent.selectedIdx === currentQuestion.correctIdx ? "✅ 答對了！" : "❌ 答錯了"}
          </div>
        )}

        {/* 進度 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span data-testid="answers-count">
            {answers.filter((a) => a.questionId === currentQuestion.id).length} 人已作答
          </span>
          {isHost && (
            <Button
              data-testid="advance-btn"
              size="sm"
              variant="ghost"
              className="ml-auto text-xs"
              onClick={onAdvance}
            >
              {currentQuestionIdx < questions.length - 1 ? "下一題 →" : "看結果"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
