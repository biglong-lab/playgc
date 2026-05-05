import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2, ThumbsUp } from "lucide-react";

export interface AmaQuestion extends Record<string, unknown> {
  questionId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface AmaUpvote extends Record<string, unknown> {
  upvoteId: string;
  userId: string;
  questionId: string;
}

export interface AmaConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
}

export interface AmaState extends Record<string, unknown> {
  questions: AmaQuestion[];
  upvotes: AmaUpvote[];
}

function extractConfig(raw: Record<string, unknown>): AmaConfig {
  return {
    title: (raw.title as string) || "Ask Me Anything",
    prompt: (raw.prompt as string) || "有什麼想問的嗎？",
    maxLength: (raw.maxLength as number) ?? 120,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function AskMeAnything({ gameId, sessionId, pageId, config: rawConfig }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: AmaState = { questions: [], upvotes: [] };
  const { state, updateState, isLoaded } = useTeamPagePersistence<AmaState>({
    gameId,
    sessionId,
    pageId,
    type: "ask_me_anything",
    defaultState,
  });

  const [input, setInput] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="ama-loading" />
      </div>
    );
  }

  function handleSubmit() {
    if (!input.trim()) return;
    const questionId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      questions: [...state.questions, { questionId, userId, userName, text: input.trim() }],
    });
    setInput("");
  }

  function handleUpvote(questionId: string) {
    const alreadyVoted = state.upvotes.some((u) => u.userId === userId && u.questionId === questionId);
    if (alreadyVoted) {
      updateState({
        ...state,
        upvotes: state.upvotes.filter((u) => !(u.userId === userId && u.questionId === questionId)),
      });
    } else {
      const upvoteId = `${userId}-${questionId}`;
      updateState({
        ...state,
        upvotes: [...state.upvotes, { upvoteId, userId, questionId }],
      });
    }
  }

  function voteCount(questionId: string) {
    return state.upvotes.filter((u) => u.questionId === questionId).length;
  }

  function hasVoted(questionId: string) {
    return state.upvotes.some((u) => u.userId === userId && u.questionId === questionId);
  }

  const sorted = [...state.questions].sort((a, b) => voteCount(b.questionId) - voteCount(a.questionId));

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="ama-title">{cfg.title}</h2>
      <p className="text-sm text-gray-500" data-testid="ama-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="ama-count">已提問：{state.questions.length} 題</p>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2 text-sm focus:border-blue-400"
          placeholder="輸入你的問題..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          maxLength={cfg.maxLength}
          data-testid="ama-input"
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
          disabled={!input.trim()}
          onClick={handleSubmit}
          data-testid="ama-submit-btn"
        >
          提問
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-gray-400 text-center py-8 text-sm" data-testid="ama-empty">
          還沒有問題，快來第一個提問！
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((q) => (
            <div
              key={q.questionId}
              className="flex items-start gap-3 p-3 border rounded-lg bg-white"
              data-testid={`ama-question-${q.questionId}`}
            >
              <div className="flex-1">
                <p className="text-sm text-gray-700">{q.text}</p>
                <p className="text-xs text-gray-400 mt-1">👤 {q.userName}</p>
              </div>
              <button
                className={`flex flex-col items-center gap-0.5 min-w-[44px] py-1 px-2 rounded transition-colors ${
                  hasVoted(q.questionId)
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-400 hover:text-blue-500"
                }`}
                onClick={() => handleUpvote(q.questionId)}
                data-testid={`ama-upvote-${q.questionId}`}
              >
                <ThumbsUp size={14} />
                <span className="text-xs font-semibold" data-testid={`ama-vote-count-${q.questionId}`}>
                  {voteCount(q.questionId)}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AskMeAnything;
