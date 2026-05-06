import { Loader2, Zap } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MotivEntry {
  entryId: string;
  userId: string;
  userName: string;
  category: string;
}

interface MotivationMapState extends Record<string, unknown> {
  entries: MotivEntry[];
  revealed: boolean;
}

interface MotivationMapConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): MotivationMapConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "動力地圖",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "最驅動你前進的核心動力是什麼？",
  };
}

const CATEGORIES = [
  {
    id: "mastery",
    label: "追求精進",
    emoji: "🎯",
    desc: "想要不斷學習，成為某領域的高手",
    color: "border-blue-400 bg-blue-50 text-blue-800",
    dot: "bg-blue-400",
  },
  {
    id: "connection",
    label: "人際連結",
    emoji: "🤝",
    desc: "從深刻的人際關係中獲得能量",
    color: "border-green-400 bg-green-50 text-green-800",
    dot: "bg-green-400",
  },
  {
    id: "autonomy",
    label: "自主空間",
    emoji: "🌊",
    desc: "能自己做決定，掌控自己的時間與方向",
    color: "border-cyan-400 bg-cyan-50 text-cyan-800",
    dot: "bg-cyan-400",
  },
  {
    id: "purpose",
    label: "使命感",
    emoji: "🌟",
    desc: "相信自己的工作有更大的意義",
    color: "border-yellow-400 bg-yellow-50 text-yellow-800",
    dot: "bg-yellow-400",
  },
  {
    id: "recognition",
    label: "被認可",
    emoji: "🏆",
    desc: "努力被看見、被肯定，帶來驅動力",
    color: "border-orange-400 bg-orange-50 text-orange-800",
    dot: "bg-orange-400",
  },
  {
    id: "security",
    label: "穩定安全",
    emoji: "🛡️",
    desc: "在穩定的環境中才能發揮最佳狀態",
    color: "border-gray-400 bg-gray-50 text-gray-800",
    dot: "bg-gray-400",
  },
] as const;

const DEFAULT_STATE: MotivationMapState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MotivationMap({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<MotivationMapState>({
    gameId,
    sessionId,
    pageId,
    type: "motivation_map",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="mm-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSelect(categoryId: string) {
    const entry: MotivEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      category: categoryId,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function countCategory(catId: string) {
    return state.entries.filter((e) => e.category === catId).length;
  }

  function getCatDef(catId: string) {
    return CATEGORIES.find((c) => c.id === catId);
  }

  const total = state.entries.length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-500" />
        <h2 className="text-xl font-bold" data-testid="mm-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="mm-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="mm-count">
        已選擇：{total} 人
      </p>

      {!myEntry ? (
        <div data-testid="mm-form" className="space-y-2">
          <p className="text-xs text-gray-500">點選最能描述你的核心動力</p>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              data-testid={`mm-cat-${c.id}`}
              onClick={() => handleSelect(c.id)}
              className={`w-full p-3 border-2 rounded-lg text-left transition-all hover:scale-[1.01] ${c.color}`}
            >
              <p className="text-sm font-bold">
                {c.emoji} {c.label}
              </p>
              <p className="text-xs opacity-70 mt-0.5">{c.desc}</p>
            </button>
          ))}
        </div>
      ) : (
        <div
          className="p-3 bg-yellow-50 rounded border border-yellow-200 text-sm"
          data-testid="mm-my-entry"
        >
          {(() => {
            const c = getCatDef(myEntry.category);
            return c ? (
              <>
                <p className="text-xs text-yellow-700 font-medium mb-1">你的核心動力</p>
                <p className="text-sm font-bold text-yellow-900">
                  {c.emoji} {c.label}
                </p>
                <p className="text-xs text-yellow-600 mt-0.5">{c.desc}</p>
              </>
            ) : null;
          })()}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="mm-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-yellow-500 text-white rounded text-sm"
        >
          揭示全隊動力地圖
        </button>
      )}

      {state.revealed && (
        <div data-testid="mm-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">⚡ 全隊核心動力分布</p>
          {total === 0 ? (
            <p data-testid="mm-empty" className="text-gray-400 text-sm">
              尚無選擇
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {CATEGORIES.map((c) => {
                  const count = countCategory(c.id);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const members = state.entries
                    .filter((e) => e.category === c.id)
                    .map((e) => e.userName);
                  return (
                    <div
                      key={c.id}
                      data-testid={`mm-bar-${c.id}`}
                      className="space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700">
                          {c.emoji} {c.label}
                        </span>
                        <span className="text-gray-400">
                          {count} 人 ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${c.dot} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {members.length > 0 && (
                        <p className="text-xs text-gray-400">{members.join("、")}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div data-testid="mm-member-list" className="space-y-1 pt-2 border-t">
                {state.entries.map((e) => {
                  const c = getCatDef(e.category);
                  return (
                    <div
                      key={e.entryId}
                      data-testid={`mm-card-${e.entryId}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${c?.dot ?? "bg-gray-300"}`}
                      />
                      <span className="text-gray-700">{e.userName}</span>
                      <span className="text-gray-400">
                        {c?.emoji} {c?.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default MotivationMap;
