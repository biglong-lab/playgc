import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface TodayWinEntry {
  entryId: string;
  userId: string;
  userName: string;
  category: string;
  win: string;
}

interface TodayWinState extends Record<string, unknown> {
  wins: TodayWinEntry[];
  revealed: boolean;
}

interface TodayWinConfig {
  title?: string;
  prompt?: string;
}

interface TodayWinProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: TodayWinConfig;
}

const CATEGORIES = [
  { key: "personal", label: "個人突破", icon: "🌟", color: "bg-yellow-100 border-yellow-400 text-yellow-800" },
  { key: "team", label: "團隊合作", icon: "🤝", color: "bg-blue-100 border-blue-400 text-blue-800" },
  { key: "insight", label: "新發現", icon: "💡", color: "bg-purple-100 border-purple-400 text-purple-800" },
];

const CARD_COLORS = [
  "bg-yellow-50 border-yellow-300",
  "bg-blue-50 border-blue-300",
  "bg-purple-50 border-purple-300",
  "bg-green-50 border-green-300",
  "bg-pink-50 border-pink-300",
  "bg-orange-50 border-orange-300",
];

export function TodayWin({ gameId, sessionId, pageId, isTeamLead, config }: TodayWinProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<TodayWinState>({
    gameId,
    sessionId,
    pageId,
    type: "today_win",
    defaultState: { wins: [], revealed: false },
  });

  const [category, setCategory] = useState("personal");
  const [win, setWin] = useState("");

  if (!isLoaded) return <div data-testid="tdw-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.wins.find((w) => w.userId === user?.id);
  const canSubmit = win.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: TodayWinEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      category,
      win: win.trim(),
    };
    updateState({ ...state, wins: [...state.wins, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="tdw-title" className="text-xl font-bold text-green-700 text-center">
        {config?.title ?? "今日小勝利"}
      </h2>
      <p data-testid="tdw-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "慶祝你今天的小勝利！分享一件讓你驕傲的事"}
      </p>
      <p data-testid="tdw-count" className="text-xs text-gray-400 text-center">
        已分享：{state.wins.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="tdw-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊勝利
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="tdw-form" className="space-y-3 bg-green-50 rounded-xl p-4">
          <div data-testid="tdw-category-grid" className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                data-testid={`tdw-cat-${c.key}`}
                onClick={() => setCategory(c.key)}
                className={`flex flex-col items-center py-2 px-1 rounded-lg border-2 text-xs font-medium transition-all ${
                  category === c.key ? `${c.color} border-2` : "bg-white border-gray-200 text-gray-500"
                }`}
              >
                <span className="text-lg">{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
          <textarea
            data-testid="tdw-win-input"
            value={win}
            onChange={(e) => setWin(e.target.value)}
            placeholder="描述你的小勝利..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
          <button
            data-testid="tdw-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            分享勝利
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="tdw-my-entry" className={`p-4 rounded-xl border-2 ${CATEGORIES.find((c) => c.key === myEntry.category)?.color ?? "bg-gray-100 border-gray-300"}`}>
          <p className="text-sm font-bold">
            {CATEGORIES.find((c) => c.key === myEntry.category)?.icon}{" "}
            {CATEGORIES.find((c) => c.key === myEntry.category)?.label}
          </p>
          <p className="text-sm mt-1">{myEntry.win}</p>
        </div>
      )}

      {state.revealed && state.wins.length === 0 && (
        <div data-testid="tdw-empty" className="text-center text-gray-400 py-8">還沒有人分享勝利</div>
      )}

      {state.revealed && state.wins.length > 0 && (
        <div data-testid="tdw-result" className="space-y-3">
          {state.wins.map((w, i) => (
            <div
              key={w.entryId}
              data-testid={`tdw-card-${w.entryId}`}
              className={`p-3 rounded-xl border ${CARD_COLORS[i % CARD_COLORS.length]}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{CATEGORIES.find((c) => c.key === w.category)?.icon}</span>
                <span className="font-medium text-sm">{w.userName}</span>
                <span className="text-xs text-gray-400">· {CATEGORIES.find((c) => c.key === w.category)?.label}</span>
              </div>
              <p className="text-sm">{w.win}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
