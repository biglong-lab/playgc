import { Loader2, Zap } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

type EnergyLevel = "high" | "low";
type WillLevel = "high" | "low";

interface EnergyEntry {
  entryId: string;
  userId: string;
  userName: string;
  energy: EnergyLevel;
  will: WillLevel;
  note: string;
}

interface EnergyMapState extends Record<string, unknown> {
  entries: EnergyEntry[];
  revealed: boolean;
}

interface EnergyMapConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): EnergyMapConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "能量地圖",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "現在的你，能量和意願各在哪個象限？",
  };
}

const DEFAULT_STATE: EnergyMapState = { entries: [], revealed: false };

const QUADRANTS = [
  {
    energy: "high" as EnergyLevel,
    will: "high" as WillLevel,
    label: "充電滿格",
    desc: "能量高 × 意願高",
    color: "bg-green-100 border-green-400 text-green-800",
    dot: "bg-green-500",
    emoji: "🔥",
  },
  {
    energy: "high" as EnergyLevel,
    will: "low" as WillLevel,
    label: "等待點火",
    desc: "能量高 × 意願低",
    color: "bg-yellow-100 border-yellow-400 text-yellow-800",
    dot: "bg-yellow-400",
    emoji: "⚡",
  },
  {
    energy: "low" as EnergyLevel,
    will: "high" as WillLevel,
    label: "燃燒殆盡",
    desc: "能量低 × 意願高",
    color: "bg-orange-100 border-orange-400 text-orange-800",
    dot: "bg-orange-400",
    emoji: "🌱",
  },
  {
    energy: "low" as EnergyLevel,
    will: "low" as WillLevel,
    label: "需要充電",
    desc: "能量低 × 意願低",
    color: "bg-red-100 border-red-400 text-red-800",
    dot: "bg-red-400",
    emoji: "🔋",
  },
] as const;

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function EnergyMap({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<EnergyMapState>({
    gameId,
    sessionId,
    pageId,
    type: "energy_map",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="em-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSelect(energy: EnergyLevel, will: WillLevel) {
    const entry: EnergyEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      energy,
      will,
      note: "",
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function countQuadrant(energy: EnergyLevel, will: WillLevel) {
    return state.entries.filter((e) => e.energy === energy && e.will === will).length;
  }

  function getQDef(energy: EnergyLevel, will: WillLevel) {
    return QUADRANTS.find((q) => q.energy === energy && q.will === will)!;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-500" />
        <h2 className="text-xl font-bold" data-testid="em-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="em-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="em-count">
        已標記：{state.entries.length} 人
      </p>

      {!myEntry ? (
        <div data-testid="em-form" className="space-y-2">
          <p className="text-xs text-gray-500">點選你目前的象限</p>
          <div className="grid grid-cols-2 gap-2">
            {QUADRANTS.map((q) => (
              <button
                key={`${q.energy}-${q.will}`}
                data-testid={`em-quadrant-${q.energy}-${q.will}`}
                onClick={() => handleSelect(q.energy, q.will)}
                className={`p-3 border-2 rounded-lg text-left transition-all hover:scale-105 ${q.color}`}
              >
                <p className="text-lg mb-1">{q.emoji}</p>
                <p className="text-xs font-bold">{q.label}</p>
                <p className="text-xs opacity-70">{q.desc}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="p-3 bg-yellow-50 rounded border border-yellow-200 text-sm"
          data-testid="em-my-entry"
        >
          {(() => {
            const q = getQDef(myEntry.energy, myEntry.will);
            return (
              <>
                <p className="text-xs text-yellow-700 font-medium mb-1">你的位置</p>
                <p className="text-sm">
                  {q.emoji} {q.label}
                </p>
                <p className="text-xs text-gray-500">{q.desc}</p>
              </>
            );
          })()}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="em-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊能量地圖
        </button>
      )}

      {state.revealed && (
        <div data-testid="em-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">⚡ 全隊能量分布</p>
          {state.entries.length === 0 ? (
            <p data-testid="em-empty" className="text-gray-400 text-sm">尚無標記</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {QUADRANTS.map((q) => {
                const count = countQuadrant(q.energy, q.will);
                const members = state.entries
                  .filter((e) => e.energy === q.energy && e.will === q.will)
                  .map((e) => e.userName);
                return (
                  <div
                    key={`${q.energy}-${q.will}`}
                    data-testid={`em-cell-${q.energy}-${q.will}`}
                    className={`p-2 border-2 rounded-lg ${q.color}`}
                  >
                    <p className="text-xs font-bold mb-1">
                      {q.emoji} {q.label} ({count})
                    </p>
                    <p className="text-xs opacity-80">
                      {members.length > 0 ? members.join("、") : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          <div data-testid="em-member-list" className="space-y-1">
            {state.entries.map((e) => {
              const q = getQDef(e.energy, e.will);
              return (
                <div
                  key={e.entryId}
                  data-testid={`em-card-${e.entryId}`}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${q.dot}`} />
                  <span className="text-gray-700">{e.userName}</span>
                  <span className="text-gray-400">{q.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default EnergyMap;
