import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface YnmVote extends Record<string, unknown> {
  voteId: string;
  userId: string;
  userName: string;
  choice: "yes" | "no" | "maybe";
}

export interface YesNoMaybeConfig extends Record<string, unknown> {
  title: string;
  question: string;
}

export interface YesNoMaybeState extends Record<string, unknown> {
  votes: YnmVote[];
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): YesNoMaybeConfig {
  return {
    title: (raw.title as string) || "✅ 快速共識確認",
    question: (raw.question as string) || "你同意這個決定嗎？",
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const CHOICES: { key: "yes" | "no" | "maybe"; emoji: string; label: string; color: string; bg: string }[] = [
  { key: "yes", emoji: "✅", label: "同意", color: "text-green-700", bg: "bg-green-100 border-green-400" },
  { key: "no", emoji: "❌", label: "不同意", color: "text-red-700", bg: "bg-red-100 border-red-400" },
  { key: "maybe", emoji: "🤔", label: "待定", color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-400" },
];

export function YesNoMaybe({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: YesNoMaybeState = { votes: [], revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<YesNoMaybeState>({
    gameId,
    sessionId,
    pageId,
    type: "yes_no_maybe",
    defaultState,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="ynm-loading" />
      </div>
    );
  }

  const myVote = state.votes.find((v) => v.userId === userId);

  function handleVote(choice: "yes" | "no" | "maybe") {
    if (myVote?.choice === choice) {
      updateState({ ...state, votes: state.votes.filter((v) => v.userId !== userId) });
    } else {
      const voteId = `${userId}-ynm`;
      const filtered = state.votes.filter((v) => v.userId !== userId);
      updateState({ ...state, votes: [...filtered, { voteId, userId, userName, choice }] });
    }
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function count(choice: "yes" | "no" | "maybe") {
    return state.votes.filter((v) => v.choice === choice).length;
  }

  const total = state.votes.length;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="ynm-title">{cfg.title}</h2>
      <p className="text-base font-medium text-gray-700 bg-gray-50 rounded p-3" data-testid="ynm-question">
        {cfg.question}
      </p>
      <p className="text-sm text-gray-400" data-testid="ynm-count">已投票：{total} 人</p>

      <div className="grid grid-cols-3 gap-3">
        {CHOICES.map((c) => (
          <button
            key={c.key}
            className={`py-4 border-2 rounded-xl flex flex-col items-center gap-1 transition-all ${
              myVote?.choice === c.key ? `${c.bg} border-2 shadow-md scale-105` : "bg-white border-gray-200 hover:border-gray-300"
            }`}
            onClick={() => handleVote(c.key)}
            data-testid={`ynm-${c.key}-btn`}
          >
            <span className="text-2xl">{c.emoji}</span>
            <span className={`text-xs font-semibold ${myVote?.choice === c.key ? c.color : "text-gray-600"}`}>
              {c.label}
            </span>
          </button>
        ))}
      </div>

      {myVote && (
        <p className="text-sm text-center text-gray-500" data-testid="ynm-my-vote">
          你選擇了：{CHOICES.find((c) => c.key === myVote.choice)?.emoji} {CHOICES.find((c) => c.key === myVote.choice)?.label}
        </p>
      )}

      {isTeamLead && !state.revealed && (
        <button
          className="w-full py-2 bg-indigo-600 text-white rounded"
          onClick={handleReveal}
          data-testid="ynm-reveal-btn"
        >
          揭曉結果
        </button>
      )}

      {state.revealed && (
        <div data-testid="ynm-result" className="space-y-3">
          <h3 className="font-semibold">📊 投票結果</h3>
          {CHOICES.map((c) => {
            const n = count(c.key);
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            return (
              <div key={c.key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className={c.color}>{c.emoji} {c.label}</span>
                  <span className="font-semibold" data-testid={`ynm-${c.key}-count`}>{n} 人 ({pct}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${c.key === "yes" ? "bg-green-400" : c.key === "no" ? "bg-red-400" : "bg-yellow-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default YesNoMaybe;
