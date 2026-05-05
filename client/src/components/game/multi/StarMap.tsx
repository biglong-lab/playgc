import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface StarDimension extends Record<string, unknown> {
  id: string;
  label: string;
}

export interface StarEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  scores: Record<string, number>;
}

export interface StarMapConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  dimensions: StarDimension[];
  max: number;
}

export interface StarMapState extends Record<string, unknown> {
  entries: StarEntry[];
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): StarMapConfig {
  const dims = Array.isArray(raw.dimensions)
    ? (raw.dimensions as StarDimension[])
    : [
        { id: "comm", label: "溝通" },
        { id: "trust", label: "信任" },
        { id: "eff", label: "效率" },
        { id: "morale", label: "士氣" },
      ];
  return {
    title: (raw.title as string) || "團隊星圖評估",
    prompt: (raw.prompt as string) || "請為每個維度評分",
    dimensions: dims,
    max: (raw.max as number) ?? 5,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function StarMap({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: StarMapState = { entries: [], revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<StarMapState>({
    gameId,
    sessionId,
    pageId,
    type: "star_map",
    defaultState,
  });

  const initScores = () =>
    Object.fromEntries(cfg.dimensions.map((d) => [d.id, Math.ceil(cfg.max / 2)]));
  const [scores, setScores] = useState<Record<string, number>>(initScores());

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="sm-loading" />
      </div>
    );
  }

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (myEntry) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      entries: [...state.entries, { entryId, userId, userName, scores }],
    });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function avgScore(dimId: string): number {
    if (state.entries.length === 0) return 0;
    const sum = state.entries.reduce((acc, e) => acc + ((e.scores as Record<string, number>)[dimId] ?? 0), 0);
    return Math.round((sum / state.entries.length) * 10) / 10;
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="sm-title">{cfg.title}</h2>
      <p className="text-gray-600" data-testid="sm-prompt">{cfg.prompt}</p>
      <p className="text-sm text-gray-500" data-testid="sm-count">已評分：{state.entries.length} 人</p>

      {!myEntry && !state.revealed && (
        <div className="space-y-3" data-testid="sm-form">
          {cfg.dimensions.map((dim) => (
            <div key={dim.id} data-testid={`sm-dim-${dim.id}`}>
              <label className="text-sm font-medium flex justify-between">
                <span>{dim.label}</span>
                <span className="text-blue-600">{scores[dim.id]} / {cfg.max}</span>
              </label>
              <input
                type="range"
                min={1}
                max={cfg.max}
                value={scores[dim.id] ?? 1}
                onChange={(e) =>
                  setScores((prev) => ({ ...prev, [dim.id]: Number(e.target.value) }))
                }
                className="w-full"
                data-testid={`sm-slider-${dim.id}`}
              />
            </div>
          ))}
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={handleSubmit}
            data-testid="sm-submit-btn"
          >
            提交評分
          </button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 bg-blue-50 rounded" data-testid="sm-my-entry">
          <p className="text-sm text-blue-700">已提交！等待揭曉...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={handleReveal}
          data-testid="sm-reveal-btn"
        >
          公開結果
        </button>
      )}

      {state.revealed && (
        <div data-testid="sm-result">
          <h3 className="font-semibold mb-3">團隊平均星圖</h3>
          <div className="space-y-3">
            {cfg.dimensions.map((dim) => {
              const avg = avgScore(dim.id);
              const pct = Math.round((avg / cfg.max) * 100);
              return (
                <div key={dim.id} data-testid={`sm-avg-${dim.id}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{dim.label}</span>
                    <span className="font-semibold text-purple-700">{avg} / {cfg.max}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-purple-500 h-4 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                      data-testid={`sm-bar-${dim.id}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {state.entries.length === 0 && (
            <p className="text-gray-400 text-center py-4" data-testid="sm-empty">尚無評分</p>
          )}
        </div>
      )}
    </div>
  );
}

export default StarMap;
