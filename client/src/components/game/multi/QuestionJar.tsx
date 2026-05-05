import { useState } from "react";
import { MessageCircleQuestion, Loader2, ThumbsUp } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface JarQuestion {
  questionId: string;
  userId: string;
  text: string;
  votes: string[];
}

interface QuestionJarState extends Record<string, unknown> {
  questions: JarQuestion[];
  revealed: boolean;
  pickedId: string | null;
}

interface QuestionJarConfig {
  title: string;
  prompt: string;
  placeholder: string;
  anonymous: boolean;
}

function extractConfig(raw: Record<string, unknown>): QuestionJarConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "問題罐",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "把你最想問的問題投進罐子裡！",
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : "你的問題（匿名送出）...",
    anonymous: raw.anonymous !== false,
  };
}

const DEFAULT_STATE: QuestionJarState = { questions: [], revealed: false, pickedId: null };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function QuestionJar({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<QuestionJarState>({
    gameId,
    sessionId,
    pageId,
    type: "question_jar",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [text, setText] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="qj-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";

  const myQuestion = state.questions.find((q) => q.userId === userId);

  function handleSubmit() {
    if (!text.trim()) return;
    const q: JarQuestion = {
      questionId: `${userId}-${Date.now()}`,
      userId,
      text: text.trim(),
      votes: [],
    };
    updateState({ ...state, questions: [...state.questions, q] });
    setText("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleVote(questionId: string) {
    const updated = state.questions.map((q) => {
      if (q.questionId !== questionId) return q;
      const hasVoted = q.votes.includes(userId);
      const votes = hasVoted
        ? q.votes.filter((v) => v !== userId)
        : [...q.votes, userId];
      return { ...q, votes };
    });
    updateState({ ...state, questions: updated });
  }

  function handlePick(questionId: string) {
    updateState({ ...state, pickedId: questionId });
  }

  const sortedByVotes = [...state.questions].sort((a, b) => b.votes.length - a.votes.length);
  const pickedQuestion = state.questions.find((q) => q.questionId === state.pickedId);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="w-5 h-5 text-teal-500" />
        <h2 className="text-xl font-bold" data-testid="qj-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="qj-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="qj-count">已投入：{state.questions.length} 個問題</p>

      {!myQuestion ? (
        <div className="space-y-2">
          <textarea
            data-testid="qj-input"
            className="w-full border rounded p-2 text-sm resize-none h-20"
            placeholder={cfg.placeholder}
            maxLength={120}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{text.length}/120</span>
            <button
              data-testid="qj-submit-btn"
              disabled={!text.trim()}
              onClick={handleSubmit}
              className="px-4 py-2 bg-teal-500 text-white rounded disabled:opacity-40 text-sm"
            >
              投入罐子
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-teal-50 rounded border border-teal-200 text-sm" data-testid="qj-my-entry">
          已投入：<span className="text-teal-700 italic">"{myQuestion.text}"</span>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="qj-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          開罐！顯示所有問題
        </button>
      )}

      {state.revealed && (
        <div data-testid="qj-result" className="space-y-3">
          {state.pickedId && pickedQuestion && (
            <div className="bg-teal-500 text-white rounded-lg p-3" data-testid="qj-picked">
              <p className="text-xs opacity-80">🎯 正在討論</p>
              <p className="text-sm font-semibold mt-1">{pickedQuestion.text}</p>
            </div>
          )}
          <p className="text-sm font-semibold text-gray-600">所有問題（👍 按讚想聽到的）</p>
          {state.questions.length === 0 ? (
            <p data-testid="qj-empty" className="text-gray-400 text-sm">罐子是空的</p>
          ) : (
            <div className="space-y-2">
              {sortedByVotes.map((q) => {
                const hasVoted = q.votes.includes(userId);
                const isPicked = q.questionId === state.pickedId;
                return (
                  <div
                    key={q.questionId}
                    data-testid={`qj-card-${q.questionId}`}
                    className={`flex items-start gap-2 rounded-lg border p-2.5 ${
                      isPicked ? "border-teal-400 bg-teal-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    <p className="text-sm text-gray-700 flex-1">{q.text}</p>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        data-testid={`qj-vote-${q.questionId}`}
                        onClick={() => handleVote(q.questionId)}
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                          hasVoted
                            ? "bg-teal-100 border-teal-300 text-teal-700"
                            : "bg-gray-50 border-gray-200 text-gray-500"
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        {q.votes.length > 0 && <span>{q.votes.length}</span>}
                      </button>
                      {isTeamLead && (
                        <button
                          data-testid={`qj-pick-${q.questionId}`}
                          onClick={() => handlePick(q.questionId)}
                          className="text-xs text-teal-600 hover:underline"
                        >
                          選這題
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default QuestionJar;
