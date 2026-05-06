import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ZenModeEntry {
  entryId: string;
  userId: string;
  userName: string;
  see: string;
  hear: string;
  feel: string;
}

interface ZenModeState extends Record<string, unknown> {
  entries: ZenModeEntry[];
  revealed: boolean;
}

interface ZenModeConfig {
  title?: string;
  prompt?: string;
}

interface ZenModeProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: ZenModeConfig;
}

const CARD_COLORS = [
  "bg-teal-50 border-teal-200",
  "bg-cyan-50 border-cyan-200",
  "bg-emerald-50 border-emerald-200",
  "bg-sky-50 border-sky-200",
  "bg-green-50 border-green-200",
  "bg-blue-50 border-blue-200",
];

export function ZenMode({ gameId, sessionId, pageId, isTeamLead, config }: ZenModeProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ZenModeState>({
    gameId,
    sessionId,
    pageId,
    type: "zen_mode",
    defaultState: { entries: [], revealed: false },
  });

  const [see, setSee] = useState("");
  const [hear, setHear] = useState("");
  const [feel, setFeel] = useState("");

  if (!isLoaded) return <div data-testid="zen-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = see.trim().length >= 1 && hear.trim().length >= 1 && feel.trim().length >= 1;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: ZenModeEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      see: see.trim(),
      hear: hear.trim(),
      feel: feel.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="zen-title" className="text-xl font-bold text-teal-700 text-center">
        {config?.title ?? "正念時刻"}
      </h2>
      <p data-testid="zen-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "靜下來，感受這一刻。你看到什麼、聽到什麼、感受到什麼？"}
      </p>
      <p data-testid="zen-count" className="text-xs text-gray-400 text-center">
        已完成：{state.entries.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="zen-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-teal-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊感受
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="zen-form" className="space-y-3 bg-teal-50 rounded-xl p-4">
          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-2 text-xs text-teal-700 font-medium mb-1">
                <span>👁️</span> 我看到...
              </label>
              <input
                data-testid="zen-see-input"
                type="text"
                value={see}
                onChange={(e) => setSee(e.target.value)}
                placeholder="眼前你注意到什麼？"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs text-teal-700 font-medium mb-1">
                <span>👂</span> 我聽到...
              </label>
              <input
                data-testid="zen-hear-input"
                type="text"
                value={hear}
                onChange={(e) => setHear(e.target.value)}
                placeholder="現在你聽到什麼聲音？"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs text-teal-700 font-medium mb-1">
                <span>🤲</span> 我感受到...
              </label>
              <input
                data-testid="zen-feel-input"
                type="text"
                value={feel}
                onChange={(e) => setFeel(e.target.value)}
                placeholder="身體或心裡有什麼感受？"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            data-testid="zen-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            完成感受
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="zen-my-entry" className="p-4 rounded-xl border-2 bg-teal-50 border-teal-300 space-y-1">
          <p className="text-xs">👁️ <span className="text-teal-800">{myEntry.see}</span></p>
          <p className="text-xs">👂 <span className="text-teal-800">{myEntry.hear}</span></p>
          <p className="text-xs">🤲 <span className="text-teal-800">{myEntry.feel}</span></p>
        </div>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="zen-empty" className="text-center text-gray-400 py-8">還沒有人完成感受</div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="zen-result" className="space-y-2">
          {state.entries.map((e, i) => (
            <div
              key={e.entryId}
              data-testid={`zen-card-${e.entryId}`}
              className={`p-3 rounded-xl border ${CARD_COLORS[i % CARD_COLORS.length]}`}
            >
              <p className="text-xs font-medium text-gray-500 mb-1">{e.userName}</p>
              <div className="space-y-0.5">
                <p className="text-xs">👁️ {e.see}</p>
                <p className="text-xs">👂 {e.hear}</p>
                <p className="text-xs">🤲 {e.feel}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
