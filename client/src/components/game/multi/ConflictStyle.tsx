import { Loader2, Swords } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface StyleEntry {
  entryId: string;
  userId: string;
  userName: string;
  style: string;
  reason: string;
}

interface ConflictStyleState extends Record<string, unknown> {
  entries: StyleEntry[];
  revealed: boolean;
}

interface ConflictStyleConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): ConflictStyleConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "衝突風格",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "遇到意見不同時，你最常用哪種方式應對？",
  };
}

const DEFAULT_STATE: ConflictStyleState = { entries: [], revealed: false };

const STYLES = [
  {
    id: "competing",
    label: "競爭型",
    emoji: "⚔️",
    desc: "我的方式才對，直接表達立場",
    color: "border-red-400 bg-red-50 text-red-800",
    dot: "bg-red-400",
  },
  {
    id: "collaborating",
    label: "合作型",
    emoji: "🤝",
    desc: "一起找到雙贏的解法",
    color: "border-green-400 bg-green-50 text-green-800",
    dot: "bg-green-500",
  },
  {
    id: "compromising",
    label: "妥協型",
    emoji: "⚖️",
    desc: "各退一步，找到中間點",
    color: "border-blue-400 bg-blue-50 text-blue-800",
    dot: "bg-blue-400",
  },
  {
    id: "avoiding",
    label: "迴避型",
    emoji: "🌙",
    desc: "先冷靜一下，不急著解決",
    color: "border-gray-400 bg-gray-50 text-gray-700",
    dot: "bg-gray-400",
  },
  {
    id: "accommodating",
    label: "順應型",
    emoji: "🌊",
    desc: "顧全大局，讓對方先",
    color: "border-purple-400 bg-purple-50 text-purple-800",
    dot: "bg-purple-400",
  },
] as const;

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ConflictStyle({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<ConflictStyleState>({
    gameId,
    sessionId,
    pageId,
    type: "conflict_style",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="cs-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSelect(styleId: string) {
    const entry: StyleEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      style: styleId,
      reason: "",
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function countStyle(styleId: string) {
    return state.entries.filter((e) => e.style === styleId).length;
  }

  function getStyleDef(styleId: string) {
    return STYLES.find((s) => s.id === styleId);
  }

  const total = state.entries.length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Swords className="w-5 h-5 text-gray-600" />
        <h2 className="text-xl font-bold" data-testid="cs-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="cs-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="cs-count">
        已選擇：{total} 人
      </p>

      {!myEntry ? (
        <div data-testid="cs-form" className="space-y-2">
          <p className="text-xs text-gray-500">點選最符合你的風格</p>
          {STYLES.map((s) => (
            <button
              key={s.id}
              data-testid={`cs-style-${s.id}`}
              onClick={() => handleSelect(s.id)}
              className={`w-full p-3 border-2 rounded-lg text-left transition-all hover:scale-[1.01] ${s.color}`}
            >
              <p className="text-sm font-bold">
                {s.emoji} {s.label}
              </p>
              <p className="text-xs opacity-70 mt-0.5">{s.desc}</p>
            </button>
          ))}
        </div>
      ) : (
        <div
          className="p-3 bg-gray-50 rounded border border-gray-200 text-sm"
          data-testid="cs-my-entry"
        >
          {(() => {
            const s = getStyleDef(myEntry.style);
            return s ? (
              <>
                <p className="text-xs text-gray-600 font-medium mb-1">你的衝突風格</p>
                <p className="text-sm font-bold">
                  {s.emoji} {s.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
              </>
            ) : null;
          })()}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="cs-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊風格
        </button>
      )}

      {state.revealed && (
        <div data-testid="cs-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">⚡ 全隊衝突風格分布</p>
          {total === 0 ? (
            <p data-testid="cs-empty" className="text-gray-400 text-sm">尚無選擇</p>
          ) : (
            <>
              <div className="space-y-2">
                {STYLES.map((s) => {
                  const count = countStyle(s.id);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const members = state.entries
                    .filter((e) => e.style === s.id)
                    .map((e) => e.userName);
                  return (
                    <div
                      key={s.id}
                      data-testid={`cs-bar-${s.id}`}
                      className="space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700">
                          {s.emoji} {s.label}
                        </span>
                        <span className="text-gray-400">
                          {count} 人 ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${s.dot} transition-all`}
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

              <div data-testid="cs-member-list" className="space-y-1 pt-2 border-t">
                {state.entries.map((e) => {
                  const s = getStyleDef(e.style);
                  return (
                    <div
                      key={e.entryId}
                      data-testid={`cs-card-${e.entryId}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s?.dot ?? "bg-gray-300"}`} />
                      <span className="text-gray-700">{e.userName}</span>
                      <span className="text-gray-400">
                        {s?.emoji} {s?.label}
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

export default ConflictStyle;
