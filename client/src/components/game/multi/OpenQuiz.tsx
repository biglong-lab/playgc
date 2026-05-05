import { useState } from "react";
import { Loader2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface OpenQuizEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  question: string;
  answer: string;
}

interface OpenQuizState extends Record<string, unknown> {
  entries: OpenQuizEntry[];
  revealed: boolean;
}

interface OpenQuizConfig {
  title?: string;
  prompt?: string;
  questionLabel?: string;
  answerLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): OpenQuizConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "開放問答",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "提一個問題並給出你自己的答案",
    questionLabel: typeof raw.questionLabel === "string" ? raw.questionLabel : "你的問題",
    answerLabel: typeof raw.answerLabel === "string" ? raw.answerLabel : "你的答案",
  };
}

const CARD_COLORS = [
  "border-blue-200 bg-blue-50",
  "border-violet-200 bg-violet-50",
  "border-emerald-200 bg-emerald-50",
  "border-amber-200 bg-amber-50",
  "border-rose-200 bg-rose-50",
];

export interface OpenQuizProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function OpenQuiz({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: OpenQuizProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<OpenQuizState>({
    gameId,
    sessionId,
    pageId,
    type: "open_quiz",
    defaultState: { entries: [], revealed: false },
  });

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="oq-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = question.trim() && answer.trim();

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: OpenQuizEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      question: question.trim(),
      answer: answer.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setQuestion("");
    setAnswer("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <HelpCircle className="w-6 h-6 text-blue-500" />
        <h2 className="text-xl font-bold" data-testid="oq-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="oq-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="oq-count">
        已提交：{state.entries.length} 組問答
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">❓ {cfg.questionLabel}</p>
            <Input
              placeholder="輸入你的問題..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={80}
              data-testid="oq-question-input"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">💡 {cfg.answerLabel}</p>
            <Input
              placeholder="輸入你的答案..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              maxLength={100}
              data-testid="oq-answer-input"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            data-testid="oq-submit-btn"
          >
            提交問答
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 text-sm" data-testid="oq-my-entry">
          <p className="font-semibold text-blue-700">❓ {myEntry.question}</p>
          <p className="text-muted-foreground mt-1">💡 {myEntry.answer}</p>
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-3" data-testid="oq-result">
          {state.entries.length === 0 ? (
            <p className="text-center text-muted-foreground" data-testid="oq-empty">尚無問答</p>
          ) : (
            state.entries.map((entry, idx) => (
              <div
                key={entry.entryId}
                data-testid={`oq-entry-${entry.entryId}`}
                className={`rounded-xl border p-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
              >
                <p className="text-xs text-muted-foreground font-medium mb-2">{entry.userName}</p>
                <p className="font-semibold text-sm">❓ {entry.question}</p>
                <p className="text-sm text-muted-foreground mt-1">💡 {entry.answer}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="oq-reveal-btn">
            揭曉所有問答
          </Button>
        )
      )}
    </div>
  );
}

export default OpenQuiz;
