import { useState } from "react";
import { TrendingUp, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface GrowthEntry {
  entryId: string;
  userId: string;
  userName: string;
  area: string;
  action: string;
}

interface GrowthEdgeState extends Record<string, unknown> {
  entries: GrowthEntry[];
  revealed: boolean;
}

interface GrowthEdgeConfig {
  title: string;
  prompt: string;
  areaPlaceholder: string;
  actionPlaceholder: string;
}

function extractConfig(raw: Record<string, unknown>): GrowthEdgeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "成長邊界",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "分享一個你想成長的領域，以及你打算採取的第一個行動。",
    areaPlaceholder: typeof raw.areaPlaceholder === "string" ? raw.areaPlaceholder : "想成長的領域（如：溝通、時間管理...）",
    actionPlaceholder: typeof raw.actionPlaceholder === "string" ? raw.actionPlaceholder : "第一步行動（如：每週讀一本書...）",
  };
}

const AREA_COLORS = [
  "bg-rose-100 border-rose-300 text-rose-700",
  "bg-amber-100 border-amber-300 text-amber-700",
  "bg-lime-100 border-lime-300 text-lime-700",
  "bg-sky-100 border-sky-300 text-sky-700",
  "bg-violet-100 border-violet-300 text-violet-700",
  "bg-pink-100 border-pink-300 text-pink-700",
];

const DEFAULT_STATE: GrowthEdgeState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function GrowthEdge({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<GrowthEdgeState>({
    gameId,
    sessionId,
    pageId,
    type: "growth_edge",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [area, setArea] = useState("");
  const [action, setAction] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="ge-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!area.trim() || !action.trim()) return;
    const entry: GrowthEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      area: area.trim(),
      action: action.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function colorForIndex(i: number) {
    return AREA_COLORS[i % AREA_COLORS.length];
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-lime-600" />
        <h2 className="text-xl font-bold" data-testid="ge-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="ge-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="ge-count">已分享：{state.entries.length} 人</p>

      {!myEntry ? (
        <div className="space-y-3">
          <input
            data-testid="ge-area-input"
            className="w-full border rounded p-2 text-sm"
            placeholder={cfg.areaPlaceholder}
            maxLength={40}
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
          <input
            data-testid="ge-action-input"
            className="w-full border rounded p-2 text-sm"
            placeholder={cfg.actionPlaceholder}
            maxLength={80}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
          <button
            data-testid="ge-submit-btn"
            disabled={!area.trim() || !action.trim()}
            onClick={handleSubmit}
            className="px-4 py-2 bg-lime-600 text-white rounded disabled:opacity-40 text-sm"
          >
            分享我的成長計畫
          </button>
        </div>
      ) : (
        <div className="p-3 bg-lime-50 rounded border border-lime-200 text-sm space-y-1" data-testid="ge-my-entry">
          <p className="font-medium text-lime-700">領域：{myEntry.area}</p>
          <p className="text-gray-600">行動：{myEntry.action}</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ge-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊成長計畫
        </button>
      )}

      {state.revealed && (
        <div data-testid="ge-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">全隊成長地圖</p>
          {state.entries.length === 0 ? (
            <p data-testid="ge-empty" className="text-gray-400 text-sm">尚無資料</p>
          ) : (
            <div className="space-y-2">
              {state.entries.map((entry, i) => (
                <div
                  key={entry.entryId}
                  data-testid={`ge-card-${entry.entryId}`}
                  className={`rounded-lg border p-3 space-y-1 ${colorForIndex(i)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{entry.userName}</span>
                    <span className="text-xs font-medium px-2 py-0.5 bg-white/60 rounded-full border">
                      {entry.area}
                    </span>
                  </div>
                  <p className="text-xs opacity-80">▶ {entry.action}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GrowthEdge;
