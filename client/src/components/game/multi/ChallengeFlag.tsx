import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SupportReaction {
  userId: string;
  emoji: string;
}

interface ChallengeEntry {
  entryId: string;
  userId: string;
  userName: string;
  challenge: string;
  reactions: SupportReaction[];
}

interface ChallengeFlagState extends Record<string, unknown> {
  entries: ChallengeEntry[];
  revealed: boolean;
}

interface ChallengeFlagConfig {
  title: string;
  prompt: string;
  placeholder: string;
}

function extractConfig(raw: Record<string, unknown>): ChallengeFlagConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "挑戰旗幟",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "現在你面臨的最大挑戰是什麼？說出來，讓團隊知道。",
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : "我目前的挑戰是...",
  };
}

const SUPPORT_EMOJIS = ["💪", "🤝", "❤️", "🌟", "👍"];
const DEFAULT_STATE: ChallengeFlagState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ChallengeFlag({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<ChallengeFlagState>({
    gameId,
    sessionId,
    pageId,
    type: "challenge_flag",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [challenge, setChallenge] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="cf-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!challenge.trim()) return;
    const entry: ChallengeEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      challenge: challenge.trim(),
      reactions: [],
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleReact(entryId: string, emoji: string) {
    const updated = state.entries.map((e) => {
      if (e.entryId !== entryId) return e;
      const hasReacted = e.reactions.some((r) => r.userId === userId && r.emoji === emoji);
      const reactions = hasReacted
        ? e.reactions.filter((r) => !(r.userId === userId && r.emoji === emoji))
        : [...e.reactions, { userId, emoji }];
      return { ...e, reactions };
    });
    updateState({ ...state, entries: updated });
  }

  function reactionCount(entry: ChallengeEntry, emoji: string) {
    return entry.reactions.filter((r) => r.emoji === emoji).length;
  }

  function hasReacted(entry: ChallengeEntry, emoji: string) {
    return entry.reactions.some((r) => r.userId === userId && r.emoji === emoji);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Flag className="w-5 h-5 text-red-500" />
        <h2 className="text-xl font-bold" data-testid="cf-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="cf-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="cf-count">已分享：{state.entries.length} 人</p>

      {!myEntry ? (
        <div className="space-y-3">
          <textarea
            data-testid="cf-input"
            className="w-full border rounded p-2 text-sm resize-none h-24"
            placeholder={cfg.placeholder}
            maxLength={120}
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{challenge.length}/120</span>
            <button
              data-testid="cf-submit-btn"
              disabled={!challenge.trim()}
              onClick={handleSubmit}
              className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-40 text-sm"
            >
              舉起我的旗幟
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-red-50 rounded border border-red-200 text-sm" data-testid="cf-my-entry">
          <p className="text-red-700 font-medium text-xs mb-1">🚩 我的挑戰</p>
          <p className="text-gray-700">{myEntry.challenge}</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="cf-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示所有挑戰
        </button>
      )}

      {state.revealed && (
        <div data-testid="cf-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">全隊挑戰牆（點 emoji 表達支持）</p>
          {state.entries.length === 0 ? (
            <p data-testid="cf-empty" className="text-gray-400 text-sm">尚無挑戰</p>
          ) : (
            <div className="space-y-3">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  data-testid={`cf-card-${entry.entryId}`}
                  className="bg-white border border-red-100 rounded-lg p-3 space-y-2 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">{entry.userName}</p>
                      <p className="text-sm text-gray-700 mt-0.5">{entry.challenge}</p>
                    </div>
                    <Flag className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {SUPPORT_EMOJIS.map((emoji) => {
                      const count = reactionCount(entry, emoji);
                      const reacted = hasReacted(entry, emoji);
                      return (
                        <button
                          key={emoji}
                          data-testid={`cf-react-${entry.entryId}-${emoji}`}
                          onClick={() => handleReact(entry.entryId, emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                            reacted
                              ? "bg-red-100 border-red-300 text-red-700"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:border-red-200"
                          }`}
                        >
                          {emoji}
                          {count > 0 && <span>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ChallengeFlag;
