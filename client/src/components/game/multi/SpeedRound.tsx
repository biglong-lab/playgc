import { useState } from "react";
import { Zap, Trophy, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ── 型別 ──────────────────────────────────────────────
export interface SpeedAnswer extends Record<string, unknown> {
  answerId: string;
  userId: string;
  userName: string;
  answer: string;
  isCorrect: boolean;
  rank: number;
}

export interface SpeedRoundConfig extends Record<string, unknown> {
  title: string;
  question: string;
  correctAnswer: string;
  answerLabel: string;
  maxLength: number;
  hint: string;
}

export interface SpeedRoundState extends Record<string, unknown> {
  answers: SpeedAnswer[];
  revealed: boolean;
}

interface Props {
  config: SpeedRoundConfig;
  state: SpeedRoundState;
  userId: string;
  isTeamLead?: boolean;
  onSubmit: (answer: string) => void;
  onReveal: () => void;
}

// ── 元件 ──────────────────────────────────────────────
export function SpeedRound({
  config,
  state,
  userId,
  isTeamLead,
  onSubmit,
  onReveal,
}: Props) {
  const [answer, setAnswer] = useState("");

  const myAnswer = state.answers.find((a) => a.userId === userId);
  const hasSubmitted = !!myAnswer;

  function handleSubmit() {
    if (!answer.trim()) return;
    onSubmit(answer.trim());
    setAnswer("");
  }

  const sorted = [...state.answers].sort((a, b) => a.rank - b.rank);
  const correctAnswers = sorted.filter((a) => a.isCorrect);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-yellow-500" />
        <h3 className="font-bold text-lg" data-testid="sr-title">
          {config.title}
        </h3>
      </div>

      <div
        className="border rounded-lg p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20"
        data-testid="sr-question"
      >
        <p className="font-semibold text-base">{config.question}</p>
        {config.hint && (
          <p className="text-sm text-muted-foreground mt-1">
            提示：{config.hint}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" data-testid="sr-count">
          <Clock className="h-3 w-3 mr-1" />
          {state.answers.length} 人已作答
        </Badge>
        {correctAnswers.length > 0 && (
          <Badge variant="secondary" data-testid="sr-correct-count">
            {correctAnswers.length} 人答對
          </Badge>
        )}
      </div>

      {!hasSubmitted && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{config.answerLabel}</p>
          <div className="flex gap-2">
            <Input
              placeholder="輸入你的答案..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              maxLength={config.maxLength}
              data-testid="sr-answer-input"
            />
            <Button
              onClick={handleSubmit}
              disabled={!answer.trim()}
              data-testid="sr-submit-btn"
            >
              搶答
            </Button>
          </div>
        </div>
      )}

      {hasSubmitted && !state.revealed && (
        <div
          className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20"
          data-testid="sr-my-answer"
        >
          <p className="text-xs text-muted-foreground mb-1">我的答案（第 {myAnswer!.rank} 位作答）</p>
          <p className="font-medium">{myAnswer!.answer}</p>
          <p className="text-xs text-muted-foreground mt-1">等待主持人揭曉正確答案...</p>
        </div>
      )}

      {!state.revealed && state.answers.length === 0 && (
        <p
          className="text-sm text-muted-foreground text-center py-4"
          data-testid="sr-empty"
        >
          還沒有人作答
        </p>
      )}

      {state.revealed && (
        <div className="space-y-3" data-testid="sr-result">
          <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-900/20">
            <p className="text-sm text-muted-foreground">正確答案</p>
            <p className="font-bold text-green-700 dark:text-green-400 text-lg">
              {config.correctAnswer}
            </p>
          </div>

          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="sr-empty">
              沒有人作答
            </p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1">
              <Trophy className="h-4 w-4 text-yellow-500" />
              作答排行
            </p>
            {sorted.map((a) => (
              <div
                key={a.answerId}
                className={`border rounded-lg p-2 flex items-center gap-3 ${a.isCorrect ? "border-green-400 bg-green-50 dark:bg-green-900/20" : ""}`}
                data-testid={`sr-answer-${a.answerId}`}
              >
                <span className="text-sm font-bold text-muted-foreground w-6">
                  #{a.rank}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.userName}</p>
                  <p className="text-xs text-muted-foreground">{a.answer}</p>
                </div>
                {a.isCorrect && (
                  <Badge className="bg-green-500">✓ 正確</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isTeamLead && !state.revealed && state.answers.length > 0 && (
        <Button
          onClick={onReveal}
          className="w-full"
          data-testid="sr-reveal-btn"
        >
          揭曉答案
        </Button>
      )}
    </div>
  );
}

export default SpeedRound;
