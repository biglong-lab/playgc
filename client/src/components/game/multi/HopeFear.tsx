import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface HfEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  hope: string;
  fear: string;
}

export interface HopeFearConfig extends Record<string, unknown> {
  title: string;
  hopePrompt: string;
  fearPrompt: string;
  maxLength: number;
}

export interface HopeFearState extends Record<string, unknown> {
  entries: HfEntry[];
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): HopeFearConfig {
  return {
    title: (raw.title as string) || "🌟 希望與恐懼",
    hopePrompt: (raw.hopePrompt as string) || "🌟 希望：我期待...",
    fearPrompt: (raw.fearPrompt as string) || "😨 恐懼：我擔心...",
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

export function HopeFear({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: HopeFearState = { entries: [], revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<HopeFearState>({
    gameId,
    sessionId,
    pageId,
    type: "hope_fear",
    defaultState,
  });

  const [hope, setHope] = useState("");
  const [fear, setFear] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="hf-loading" />
      </div>
    );
  }

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!hope.trim() || !fear.trim() || myEntry) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      entries: [...state.entries, { entryId, userId, userName, hope: hope.trim(), fear: fear.trim() }],
    });
    setHope("");
    setFear("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="hf-title">{cfg.title}</h2>
      <p className="text-sm text-gray-400" data-testid="hf-count">已提交：{state.entries.length} 人</p>

      {!myEntry && !state.revealed && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-amber-700">{cfg.hopePrompt}</label>
            <textarea
              className="w-full border border-amber-200 rounded px-3 py-2 h-20 mt-1 focus:border-amber-400 text-sm"
              placeholder="寫下你的期待或希望..."
              value={hope}
              onChange={(e) => setHope(e.target.value)}
              maxLength={cfg.maxLength}
              data-testid="hf-hope-input"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600">{cfg.fearPrompt}</label>
            <textarea
              className="w-full border border-slate-200 rounded px-3 py-2 h-20 mt-1 focus:border-slate-400 text-sm"
              placeholder="寫下你的擔憂或恐懼..."
              value={fear}
              onChange={(e) => setFear(e.target.value)}
              maxLength={cfg.maxLength}
              data-testid="hf-fear-input"
            />
          </div>
          <button
            className="w-full py-2 bg-amber-600 text-white rounded disabled:opacity-50"
            disabled={!hope.trim() || !fear.trim()}
            onClick={handleSubmit}
            data-testid="hf-submit-btn"
          >
            提交
          </button>
        </div>
      )}

      {myEntry && (
        <div className="grid grid-cols-2 gap-2" data-testid="hf-my-entry">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
            <p className="font-semibold text-amber-700 mb-1">🌟 希望</p>
            <p className="text-gray-700">{myEntry.hope}</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-sm">
            <p className="font-semibold text-slate-600 mb-1">😨 恐懼</p>
            <p className="text-gray-700">{myEntry.fear}</p>
          </div>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          className="w-full py-2 bg-amber-600 text-white rounded"
          onClick={handleReveal}
          data-testid="hf-reveal-btn"
        >
          揭曉所有回饋
        </button>
      )}

      {state.revealed && (
        <div data-testid="hf-result">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <h3 className="text-center text-sm font-bold text-amber-700">🌟 希望</h3>
            <h3 className="text-center text-sm font-bold text-slate-600">😨 恐懼</h3>
          </div>
          {state.entries.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-sm" data-testid="hf-empty">沒有人提交</p>
          ) : (
            <div className="space-y-2">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  className="border rounded-lg overflow-hidden"
                  data-testid={`hf-entry-${entry.entryId}`}
                >
                  <div className="px-3 py-1 bg-gray-100 text-xs font-semibold text-gray-600">
                    👤 {entry.userName}
                  </div>
                  <div className="grid grid-cols-2 divide-x text-sm">
                    <div className="p-2 bg-amber-50">
                      <p className="text-gray-700">{entry.hope}</p>
                    </div>
                    <div className="p-2 bg-slate-50">
                      <p className="text-gray-700">{entry.fear}</p>
                    </div>
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

export default HopeFear;
