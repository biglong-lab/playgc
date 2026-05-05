import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface GiveGetEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  give: string;
  get: string;
}

export interface GiveGetConfig extends Record<string, unknown> {
  title: string;
  givePrompt: string;
  getPrompt: string;
  maxLength: number;
}

export interface GiveGetState extends Record<string, unknown> {
  entries: GiveGetEntry[];
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): GiveGetConfig {
  return {
    title: (raw.title as string) || "Give & Get 技能交換",
    givePrompt: (raw.givePrompt as string) || "💪 我可以提供...",
    getPrompt: (raw.getPrompt as string) || "🙏 我需要幫助...",
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

export function GiveGet({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: GiveGetState = { entries: [], revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<GiveGetState>({
    gameId,
    sessionId,
    pageId,
    type: "give_get",
    defaultState,
  });

  const [give, setGive] = useState("");
  const [get, setGet] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="gvgt-loading" />
      </div>
    );
  }

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!give.trim() || !get.trim() || myEntry) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      entries: [...state.entries, { entryId, userId, userName, give: give.trim(), get: get.trim() }],
    });
    setGive("");
    setGet("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="gvgt-title">{cfg.title}</h2>
      <p className="text-sm text-gray-400" data-testid="gvgt-count">已提交：{state.entries.length} 人</p>

      {!myEntry && !state.revealed && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-green-700">{cfg.givePrompt}</label>
            <textarea
              className="w-full border border-green-200 rounded px-3 py-2 h-20 mt-1 focus:border-green-400"
              placeholder="寫下你能貢獻的技能或幫助..."
              value={give}
              onChange={(e) => setGive(e.target.value)}
              data-testid="gvgt-give-input"
              maxLength={cfg.maxLength}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-blue-700">{cfg.getPrompt}</label>
            <textarea
              className="w-full border border-blue-200 rounded px-3 py-2 h-20 mt-1 focus:border-blue-400"
              placeholder="寫下你希望獲得的幫助或資源..."
              value={get}
              onChange={(e) => setGet(e.target.value)}
              data-testid="gvgt-get-input"
              maxLength={cfg.maxLength}
            />
          </div>
          <button
            className="w-full py-2 bg-purple-600 text-white rounded disabled:opacity-50"
            disabled={!give.trim() || !get.trim()}
            onClick={handleSubmit}
            data-testid="gvgt-submit-btn"
          >
            提交
          </button>
        </div>
      )}

      {myEntry && (
        <div className="space-y-2" data-testid="gvgt-my-entry">
          <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
            <span className="font-semibold text-green-700">💪 提供：</span>{myEntry.give}
          </div>
          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
            <span className="font-semibold text-blue-700">🙏 需要：</span>{myEntry.get}
          </div>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          className="w-full py-2 bg-green-600 text-white rounded"
          onClick={handleReveal}
          data-testid="gvgt-reveal-btn"
        >
          公開技能交換板
        </button>
      )}

      {state.revealed && (
        <div data-testid="gvgt-result">
          <h3 className="font-semibold mb-3">🔄 技能交換看板</h3>
          {state.entries.length === 0 ? (
            <p className="text-gray-400 text-center py-4" data-testid="gvgt-empty">沒有人提交</p>
          ) : (
            <div className="grid gap-3">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  className="border rounded-lg overflow-hidden"
                  data-testid={`gvgt-entry-${entry.entryId}`}
                >
                  <div className="px-3 py-1 bg-gray-100 text-xs font-semibold text-gray-600">
                    👤 {entry.userName}
                  </div>
                  <div className="grid grid-cols-2 divide-x">
                    <div className="p-2 bg-green-50">
                      <p className="text-xs font-semibold text-green-700 mb-1">💪 可給予</p>
                      <p className="text-sm text-gray-700">{entry.give}</p>
                    </div>
                    <div className="p-2 bg-blue-50">
                      <p className="text-xs font-semibold text-blue-700 mb-1">🙏 想獲得</p>
                      <p className="text-sm text-gray-700">{entry.get}</p>
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

export default GiveGet;
