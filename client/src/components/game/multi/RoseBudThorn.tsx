import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface RbtEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  rose: string;
  bud: string;
  thorn: string;
}

export interface RbtConfig extends Record<string, unknown> {
  title: string;
  rosePrompt: string;
  budPrompt: string;
  thornPrompt: string;
  maxLength: number;
}

export interface RbtState extends Record<string, unknown> {
  entries: RbtEntry[];
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): RbtConfig {
  return {
    title: (raw.title as string) || "🌹 Rose Bud Thorn 回顧",
    rosePrompt: (raw.rosePrompt as string) || "🌹 Rose：值得慶祝的事",
    budPrompt: (raw.budPrompt as string) || "🌱 Bud：值得期待的潛力",
    thornPrompt: (raw.thornPrompt as string) || "🌵 Thorn：遇到的困難或阻礙",
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

export function RoseBudThorn({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: RbtState = { entries: [], revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<RbtState>({
    gameId,
    sessionId,
    pageId,
    type: "rose_bud_thorn",
    defaultState,
  });

  const [rose, setRose] = useState("");
  const [bud, setBud] = useState("");
  const [thorn, setThorn] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="rbt-loading" />
      </div>
    );
  }

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!rose.trim() || !bud.trim() || !thorn.trim() || myEntry) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      entries: [...state.entries, { entryId, userId, userName, rose: rose.trim(), bud: bud.trim(), thorn: thorn.trim() }],
    });
    setRose("");
    setBud("");
    setThorn("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="rbt-title">{cfg.title}</h2>
      <p className="text-sm text-gray-400" data-testid="rbt-count">已提交：{state.entries.length} 人</p>

      {!myEntry && !state.revealed && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-rose-700">{cfg.rosePrompt}</label>
            <textarea
              className="w-full border border-rose-200 rounded px-3 py-2 h-16 mt-1 focus:border-rose-400 text-sm"
              placeholder="輸入你的 Rose..."
              value={rose}
              onChange={(e) => setRose(e.target.value)}
              maxLength={cfg.maxLength}
              data-testid="rbt-rose-input"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-green-700">{cfg.budPrompt}</label>
            <textarea
              className="w-full border border-green-200 rounded px-3 py-2 h-16 mt-1 focus:border-green-400 text-sm"
              placeholder="輸入你的 Bud..."
              value={bud}
              onChange={(e) => setBud(e.target.value)}
              maxLength={cfg.maxLength}
              data-testid="rbt-bud-input"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">{cfg.thornPrompt}</label>
            <textarea
              className="w-full border border-gray-200 rounded px-3 py-2 h-16 mt-1 focus:border-gray-400 text-sm"
              placeholder="輸入你的 Thorn..."
              value={thorn}
              onChange={(e) => setThorn(e.target.value)}
              maxLength={cfg.maxLength}
              data-testid="rbt-thorn-input"
            />
          </div>
          <button
            className="w-full py-2 bg-rose-600 text-white rounded disabled:opacity-50"
            disabled={!rose.trim() || !bud.trim() || !thorn.trim()}
            onClick={handleSubmit}
            data-testid="rbt-submit-btn"
          >
            提交
          </button>
        </div>
      )}

      {myEntry && (
        <div className="grid grid-cols-3 gap-2" data-testid="rbt-my-entry">
          <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs">
            <p className="font-semibold text-rose-700 mb-1">🌹 Rose</p>
            <p className="text-gray-700">{myEntry.rose}</p>
          </div>
          <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
            <p className="font-semibold text-green-700 mb-1">🌱 Bud</p>
            <p className="text-gray-700">{myEntry.bud}</p>
          </div>
          <div className="p-2 bg-gray-50 border border-gray-200 rounded text-xs">
            <p className="font-semibold text-gray-600 mb-1">🌵 Thorn</p>
            <p className="text-gray-700">{myEntry.thorn}</p>
          </div>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          className="w-full py-2 bg-rose-600 text-white rounded"
          onClick={handleReveal}
          data-testid="rbt-reveal-btn"
        >
          揭曉所有回顧
        </button>
      )}

      {state.revealed && (
        <div data-testid="rbt-result">
          <div className="grid grid-cols-3 gap-3 mb-2">
            <h3 className="text-center text-sm font-bold text-rose-700">🌹 Rose</h3>
            <h3 className="text-center text-sm font-bold text-green-700">🌱 Bud</h3>
            <h3 className="text-center text-sm font-bold text-gray-600">🌵 Thorn</h3>
          </div>
          {state.entries.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-sm" data-testid="rbt-empty">沒有人提交</p>
          ) : (
            <div className="space-y-3">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  className="border rounded-lg overflow-hidden"
                  data-testid={`rbt-entry-${entry.entryId}`}
                >
                  <div className="px-3 py-1 bg-gray-100 text-xs font-semibold text-gray-600">
                    👤 {entry.userName}
                  </div>
                  <div className="grid grid-cols-3 divide-x text-xs">
                    <div className="p-2 bg-rose-50">
                      <p className="text-gray-700">{entry.rose}</p>
                    </div>
                    <div className="p-2 bg-green-50">
                      <p className="text-gray-700">{entry.bud}</p>
                    </div>
                    <div className="p-2 bg-gray-50">
                      <p className="text-gray-700">{entry.thorn}</p>
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

export default RoseBudThorn;
