import { useState } from "react";
import { Briefcase, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface WorkStyleEntry {
  entryId: string;
  userId: string;
  userName: string;
  collab: number;
  structure: number;
}

interface WorkStyleState extends Record<string, unknown> {
  entries: WorkStyleEntry[];
  revealed: boolean;
}

interface WorkStyleConfig {
  title: string;
  prompt: string;
  collabLow: string;
  collabHigh: string;
  structureLow: string;
  structureHigh: string;
}

function extractConfig(raw: Record<string, unknown>): WorkStyleConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "工作風格",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "拖曳滑桿，定位你的工作風格偏好。",
    collabLow: typeof raw.collabLow === "string" ? raw.collabLow : "獨立作業",
    collabHigh: typeof raw.collabHigh === "string" ? raw.collabHigh : "協作共創",
    structureLow: typeof raw.structureLow === "string" ? raw.structureLow : "彈性自由",
    structureHigh: typeof raw.structureHigh === "string" ? raw.structureHigh : "結構清晰",
  };
}

const DEFAULT_STATE: WorkStyleState = { entries: [], revealed: false };

function quadrant(collab: number, structure: number): string {
  const c = collab >= 50 ? "協作" : "獨立";
  const s = structure >= 50 ? "結構" : "彈性";
  return `${c}＋${s}`;
}

const QUADRANT_COLORS: Record<string, string> = {
  "協作＋結構": "bg-sky-100 text-sky-700",
  "協作＋彈性": "bg-violet-100 text-violet-700",
  "獨立＋結構": "bg-amber-100 text-amber-700",
  "獨立＋彈性": "bg-emerald-100 text-emerald-700",
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function WorkStyle({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<WorkStyleState>({
    gameId,
    sessionId,
    pageId,
    type: "work_style",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [collab, setCollab] = useState(50);
  const [structure, setStructure] = useState(50);

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="ws-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    const entry: WorkStyleEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      collab,
      structure,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const avgCollab = state.entries.length > 0
    ? Math.round(state.entries.reduce((s, e) => s + e.collab, 0) / state.entries.length)
    : 50;
  const avgStructure = state.entries.length > 0
    ? Math.round(state.entries.reduce((s, e) => s + e.structure, 0) / state.entries.length)
    : 50;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-sky-600" />
        <h2 className="text-xl font-bold" data-testid="ws-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="ws-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="ws-count">已回答：{state.entries.length} 人</p>

      {!myEntry ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{cfg.collabLow}</span>
              <span>{cfg.collabHigh}</span>
            </div>
            <input
              data-testid="ws-collab-slider"
              type="range"
              min={0}
              max={100}
              value={collab}
              onChange={(e) => setCollab(Number(e.target.value))}
              className="w-full accent-sky-500"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{cfg.structureLow}</span>
              <span>{cfg.structureHigh}</span>
            </div>
            <input
              data-testid="ws-structure-slider"
              type="range"
              min={0}
              max={100}
              value={structure}
              onChange={(e) => setStructure(Number(e.target.value))}
              className="w-full accent-sky-500"
            />
          </div>
          <div className="text-center">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                QUADRANT_COLORS[quadrant(collab, structure)] ?? "bg-gray-100 text-gray-600"
              }`}
              data-testid="ws-preview-quadrant"
            >
              {quadrant(collab, structure)}
            </span>
          </div>
          <button
            data-testid="ws-submit-btn"
            onClick={handleSubmit}
            className="px-4 py-2 bg-sky-500 text-white rounded text-sm"
          >
            送出我的工作風格
          </button>
        </div>
      ) : (
        <div className="p-3 bg-sky-50 rounded border border-sky-200 text-sm" data-testid="ws-my-entry">
          我的風格：
          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${QUADRANT_COLORS[quadrant(myEntry.collab, myEntry.structure)] ?? ""}`}>
            {quadrant(myEntry.collab, myEntry.structure)}
          </span>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ws-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊工作風格
        </button>
      )}

      {state.revealed && (
        <div data-testid="ws-result" className="space-y-3">
          <div className="bg-white border rounded-lg p-3 space-y-2">
            <p className="text-xs text-gray-500 font-medium">全隊平均</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{cfg.collabLow}</span>
                <span>{cfg.collabHigh}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div
                  data-testid="ws-avg-collab-bar"
                  className="h-2 bg-sky-400 rounded-full"
                  style={{ width: `${avgCollab}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>{cfg.structureLow}</span>
                <span>{cfg.structureHigh}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div
                  data-testid="ws-avg-structure-bar"
                  className="h-2 bg-sky-400 rounded-full"
                  style={{ width: `${avgStructure}%` }}
                />
              </div>
            </div>
            <p className="text-center text-sm font-medium text-sky-700 mt-1">
              全隊風格：{quadrant(avgCollab, avgStructure)}
            </p>
          </div>
          {state.entries.length === 0 ? (
            <p data-testid="ws-empty" className="text-gray-400 text-sm">尚無資料</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  data-testid={`ws-card-${entry.entryId}`}
                  className={`px-2 py-1 rounded-lg text-xs ${QUADRANT_COLORS[quadrant(entry.collab, entry.structure)] ?? "bg-gray-100 text-gray-600"}`}
                >
                  <p className="font-medium">{entry.userName}</p>
                  <p className="opacity-80">{quadrant(entry.collab, entry.structure)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WorkStyle;
