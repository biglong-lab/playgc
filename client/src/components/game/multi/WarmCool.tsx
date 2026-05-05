import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface WarmCoolEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  warm: string;
  cool: string;
}

export interface WarmCoolConfig extends Record<string, unknown> {
  title: string;
  target: string;
  warmPrompt: string;
  coolPrompt: string;
  maxLength: number;
}

export interface WarmCoolState extends Record<string, unknown> {
  entries: WarmCoolEntry[];
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): WarmCoolConfig {
  return {
    title: (raw.title as string) || "暖 / 涼 回饋",
    target: (raw.target as string) || "這次活動",
    warmPrompt: (raw.warmPrompt as string) || "🔥 暖：什麼做得很好？",
    coolPrompt: (raw.coolPrompt as string) || "❄️ 涼：什麼可以改善？",
    maxLength: (raw.maxLength as number) ?? 100,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function WarmCool({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: WarmCoolState = { entries: [], revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<WarmCoolState>({
    gameId,
    sessionId,
    pageId,
    type: "warm_cool",
    defaultState,
  });

  const [warm, setWarm] = useState("");
  const [cool, setCool] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="wc-loading" />
      </div>
    );
  }

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!warm.trim() || !cool.trim() || myEntry) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      entries: [...state.entries, { entryId, userId, userName, warm: warm.trim(), cool: cool.trim() }],
    });
    setWarm("");
    setCool("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="wc-title">{cfg.title}</h2>
      <p className="text-sm text-gray-500 text-center">關於：{cfg.target}</p>
      <p className="text-sm text-gray-400" data-testid="wc-count">已回饋：{state.entries.length} 人</p>

      {!myEntry && !state.revealed && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-orange-600">{cfg.warmPrompt}</label>
            <textarea
              className="w-full border border-orange-200 rounded px-3 py-2 h-20 mt-1 focus:border-orange-400"
              placeholder="寫下正面的回饋..."
              value={warm}
              onChange={(e) => setWarm(e.target.value)}
              data-testid="wc-warm-input"
              maxLength={cfg.maxLength}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-blue-600">{cfg.coolPrompt}</label>
            <textarea
              className="w-full border border-blue-200 rounded px-3 py-2 h-20 mt-1 focus:border-blue-400"
              placeholder="寫下建設性的建議..."
              value={cool}
              onChange={(e) => setCool(e.target.value)}
              data-testid="wc-cool-input"
              maxLength={cfg.maxLength}
            />
          </div>
          <button
            className="w-full py-2 bg-purple-600 text-white rounded disabled:opacity-50"
            disabled={!warm.trim() || !cool.trim()}
            onClick={handleSubmit}
            data-testid="wc-submit-btn"
          >
            提交回饋
          </button>
        </div>
      )}

      {myEntry && (
        <div className="space-y-2" data-testid="wc-my-entry">
          <div className="p-2 bg-orange-50 border border-orange-200 rounded text-sm">
            <span className="font-semibold text-orange-600">🔥 暖：</span>{myEntry.warm}
          </div>
          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
            <span className="font-semibold text-blue-600">❄️ 涼：</span>{myEntry.cool}
          </div>
          <p className="text-xs text-gray-400 text-center">已提交，等待主持人揭曉</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          className="w-full py-2 bg-green-600 text-white rounded"
          onClick={handleReveal}
          data-testid="wc-reveal-btn"
        >
          公開所有回饋
        </button>
      )}

      {state.revealed && (
        <div data-testid="wc-result">
          <h3 className="font-semibold mb-3">全隊回饋（{state.entries.length} 份）</h3>
          {state.entries.length === 0 ? (
            <p className="text-gray-400 text-center py-4" data-testid="wc-empty">沒有回饋</p>
          ) : (
            <div className="space-y-4">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  className="border rounded-lg overflow-hidden"
                  data-testid={`wc-entry-${entry.entryId}`}
                >
                  <div className="px-3 py-1 bg-gray-100 text-xs font-semibold text-gray-600">
                    {entry.userName}
                  </div>
                  <div className="p-3 bg-orange-50 border-t border-orange-100">
                    <p className="text-xs font-semibold text-orange-600 mb-1">🔥 暖</p>
                    <p className="text-sm text-gray-700">{entry.warm}</p>
                  </div>
                  <div className="p-3 bg-blue-50 border-t border-blue-100">
                    <p className="text-xs font-semibold text-blue-600 mb-1">❄️ 涼</p>
                    <p className="text-sm text-gray-700">{entry.cool}</p>
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

export default WarmCool;
