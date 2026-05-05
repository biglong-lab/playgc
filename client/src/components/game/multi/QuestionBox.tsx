// 📬 QuestionBox — 匿名提問箱，L3 持久化
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, CheckCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Question {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  votes: string[];
  answered: boolean;
  createdAt: number;
}

export interface QuestionBoxConfig {
  title: string;
  prompt?: string;
  allowAnonymous: boolean;
  maxQuestionsPerPerson: number;
  maxQuestionLength: number;
}

export interface QuestionBoxState extends Record<string, unknown> {
  questions: Question[];
}

interface QuestionBoxProps {
  config: QuestionBoxConfig;
  state: QuestionBoxState;
  myUserId: string;
  myUserName: string;
  onSubmit: (text: string) => Promise<void>;
  onVote: (questionId: string) => Promise<void>;
  onMarkAnswered: (questionId: string) => Promise<void>;
}

export default function QuestionBox({
  config,
  state,
  myUserId,
  myUserName,
  onSubmit,
  onVote,
  onMarkAnswered,
}: QuestionBoxProps) {
  const { questions } = state;
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const myQuestions = questions.filter((q) => q.authorId === myUserId);
  const canSubmit = myQuestions.length < config.maxQuestionsPerPerson && text.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(text.trim());
      setText("");
    } finally {
      setSubmitting(false);
    }
  };

  const sorted = [...questions].sort((a, b) => {
    if (a.answered !== b.answered) return a.answered ? 1 : -1;
    return b.votes.length - a.votes.length;
  });

  const pending = sorted.filter((q) => !q.answered);
  const answered = sorted.filter((q) => q.answered);

  return (
    <Card data-testid="question-box-root">
      <CardContent className="p-6 space-y-5">
        {/* 標題 */}
        <div>
          <h2 data-testid="question-box-title" className="text-xl font-bold">{config.title}</h2>
          {config.prompt && (
            <p data-testid="question-box-prompt" className="text-muted-foreground text-sm mt-1">
              {config.prompt}
            </p>
          )}
        </div>

        {/* 提問輸入 */}
        <div className="space-y-2">
          <Textarea
            data-testid="question-input"
            placeholder="輸入你的問題…"
            value={text}
            maxLength={config.maxQuestionLength}
            onChange={(e) => setText(e.target.value)}
            className="resize-none"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              <span data-testid="question-count">{myQuestions.length}</span>/{config.maxQuestionsPerPerson} 已提問
              {config.allowAnonymous && " · 匿名顯示"}
            </span>
            <Button
              data-testid="submit-question-btn"
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              送出問題
            </Button>
          </div>
        </div>

        {/* 問題清單 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <MessageSquare className="w-4 h-4" />
            <span data-testid="total-questions">{questions.length} 個問題</span>
          </div>

          {pending.length === 0 && answered.length === 0 && (
            <div data-testid="empty-msg" className="text-center text-muted-foreground text-sm py-6">
              還沒有人提問，成為第一個！
            </div>
          )}

          {/* 待回答 */}
          {pending.map((q) => {
            const hasVoted = q.votes.includes(myUserId);
            const isMyQuestion = q.authorId === myUserId;
            return (
              <div
                key={q.id}
                data-testid={`question-item-${q.id}`}
                className={cn(
                  "p-3 rounded-lg border",
                  isMyQuestion ? "border-blue-200 bg-blue-50/50 dark:bg-blue-900/10" : "border-border"
                )}
              >
                <p className="text-sm leading-relaxed">{q.text}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {config.allowAnonymous ? "匿名" : q.authorName}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      data-testid={`vote-btn-${q.id}`}
                      onClick={() => onVote(q.id)}
                      disabled={isMyQuestion}
                      className={cn(
                        "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors",
                        hasVoted
                          ? "text-blue-600 bg-blue-100 dark:bg-blue-900/30"
                          : "text-muted-foreground hover:text-blue-600 hover:bg-blue-50",
                        isMyQuestion ? "opacity-40 cursor-not-allowed" : ""
                      )}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span data-testid={`vote-count-${q.id}`}>{q.votes.length}</span>
                    </button>
                    <button
                      data-testid={`mark-answered-${q.id}`}
                      onClick={() => onMarkAnswered(q.id)}
                      className="text-xs text-muted-foreground hover:text-green-600 px-2 py-1 rounded-md hover:bg-green-50 transition-colors"
                    >
                      ✓ 已回答
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 已回答 */}
          {answered.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">已回答</h3>
              {answered.map((q) => (
                <div
                  key={q.id}
                  data-testid={`answered-item-${q.id}`}
                  className="p-3 rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-900/10 opacity-70"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <p className="text-sm line-through text-muted-foreground">{q.text}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-6">
                    <Badge variant="secondary" className="text-xs">{q.votes.length} 票</Badge>
                    <span className="text-xs text-muted-foreground">
                      {config.allowAnonymous ? "匿名" : q.authorName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
