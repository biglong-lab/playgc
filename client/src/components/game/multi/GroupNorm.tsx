import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2, ThumbsUp } from "lucide-react";

export interface GroupNormItem extends Record<string, unknown> {
  normId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface NormVote extends Record<string, unknown> {
  voteId: string;
  userId: string;
  normId: string;
}

export interface GroupNormConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
}

export interface GroupNormState extends Record<string, unknown> {
  norms: GroupNormItem[];
  votes: NormVote[];
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): GroupNormConfig {
  return {
    title: (raw.title as string) || "📜 團隊工作約定",
    prompt: (raw.prompt as string) || "提出一條你希望團隊遵守的工作約定",
    maxLength: (raw.maxLength as number) ?? 80,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function GroupNorm({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: GroupNormState = { norms: [], votes: [], revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<GroupNormState>({
    gameId,
    sessionId,
    pageId,
    type: "group_norm",
    defaultState,
  });

  const [input, setInput] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="gn-loading" />
      </div>
    );
  }

  function handleSubmit() {
    if (!input.trim()) return;
    const normId = `${userId}-${Date.now()}`;
    updateState({ ...state, norms: [...state.norms, { normId, userId, userName, text: input.trim() }] });
    setInput("");
  }

  function handleVote(normId: string) {
    const alreadyVoted = state.votes.some((v) => v.userId === userId && v.normId === normId);
    if (alreadyVoted) {
      updateState({ ...state, votes: state.votes.filter((v) => !(v.userId === userId && v.normId === normId)) });
    } else {
      const voteId = `${userId}-${normId}`;
      updateState({ ...state, votes: [...state.votes, { voteId, userId, normId }] });
    }
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function voteCount(normId: string) {
    return state.votes.filter((v) => v.normId === normId).length;
  }

  function hasVoted(normId: string) {
    return state.votes.some((v) => v.userId === userId && v.normId === normId);
  }

  const sorted = state.revealed
    ? [...state.norms].sort((a, b) => voteCount(b.normId) - voteCount(a.normId))
    : state.norms;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="gn-title">{cfg.title}</h2>
      <p className="text-sm text-gray-500" data-testid="gn-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="gn-count">已提出：{state.norms.length} 條約定</p>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2 text-sm focus:border-indigo-400"
          placeholder="例：開會前先確認議程..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          maxLength={cfg.maxLength}
          data-testid="gn-input"
        />
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm disabled:opacity-50"
          disabled={!input.trim()}
          onClick={handleSubmit}
          data-testid="gn-submit-btn"
        >
          提出
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-gray-400 text-center py-8 text-sm" data-testid="gn-empty">
          還沒有人提出約定，快來第一個！
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((norm) => (
            <div
              key={norm.normId}
              className="flex items-center gap-3 p-3 border rounded-lg bg-white"
              data-testid={`gn-norm-${norm.normId}`}
            >
              <div className="flex-1">
                <p className="text-sm text-gray-700">{norm.text}</p>
                <p className="text-xs text-gray-400 mt-0.5">👤 {norm.userName}</p>
              </div>
              <button
                className={`flex flex-col items-center gap-0.5 min-w-[44px] py-1 px-2 rounded transition-colors ${
                  hasVoted(norm.normId)
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-gray-400 hover:text-indigo-500"
                }`}
                onClick={() => handleVote(norm.normId)}
                data-testid={`gn-vote-${norm.normId}`}
              >
                <ThumbsUp size={14} />
                <span className="text-xs font-semibold" data-testid={`gn-vote-count-${norm.normId}`}>
                  {voteCount(norm.normId)}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          className="w-full py-2 bg-indigo-600 text-white rounded text-sm"
          onClick={handleReveal}
          data-testid="gn-reveal-btn"
        >
          完成 — 按讚數排序
        </button>
      )}

      {state.revealed && (
        <div data-testid="gn-result" className="p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-700">
          ✅ 共識確立！以上是本次共建的 {state.norms.length} 條團隊約定
        </div>
      )}
    </div>
  );
}

export default GroupNorm;
