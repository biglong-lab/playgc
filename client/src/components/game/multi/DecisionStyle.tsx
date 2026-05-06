import { Loader2, Scale } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface DecisionEntry {
  entryId: string;
  userId: string;
  userName: string;
  style: string;
}

interface DecisionStyleState extends Record<string, unknown> {
  entries: DecisionEntry[];
  revealed: boolean;
}

interface DecisionStyleConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): DecisionStyleConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "決策風格",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "面對重要決定時，你最傾向哪種方式？",
  };
}

const STYLES = [
  {
    id: "data",
    label: "數據導向",
    emoji: "📊",
    desc: "收集數據、分析證據，讓數字說話",
    color: "border-blue-400 bg-blue-50 text-blue-800",
    dot: "bg-blue-400",
  },
  {
    id: "intuition",
    label: "直覺導向",
    emoji: "💡",
    desc: "相信第一直覺，快速決定然後行動",
    color: "border-yellow-400 bg-yellow-50 text-yellow-800",
    dot: "bg-yellow-400",
  },
  {
    id: "consensus",
    label: "共識導向",
    emoji: "🤝",
    desc: "聽取所有聲音，確保大家都能認同",
    color: "border-green-400 bg-green-50 text-green-800",
    dot: "bg-green-400",
  },
  {
    id: "authority",
    label: "權威導向",
    emoji: "👑",
    desc: "諮詢專家或有決策權的人，尊重判斷",
    color: "border-purple-400 bg-purple-50 text-purple-800",
    dot: "bg-purple-400",
  },
  {
    id: "experiment",
    label: "實驗導向",
    emoji: "🧪",
    desc: "小規模試試看，從結果中學習再決定",
    color: "border-rose-400 bg-rose-50 text-rose-800",
    dot: "bg-rose-400",
  },
] as const;

const DEFAULT_STATE: DecisionStyleState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function DecisionStyle({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<DecisionStyleState>({
    gameId,
    sessionId,
    pageId,
    type: "decision_style",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="ds-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSelect(styleId: string) {
    const entry: DecisionEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      style: styleId,
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
        <Scale className="w-5 h-5 text-purple-500" />
        <h2 className="text-xl font-bold" data-testid="ds-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="ds-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="ds-count">
        已選擇：{total} 人
      </p>

      {!myEntry ? (
        <div data-testid="ds-form" className="space-y-2">
          <p className="text-xs text-gray-500">點選最接近你決策方式的選項</p>
          {STYLES.map((s) => (
            <button
              key={s.id}
              data-testid={`ds-style-${s.id}`}
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
          className="p-3 bg-purple-50 rounded border border-purple-200 text-sm"
          data-testid="ds-my-entry"
        >
          {(() => {
            const s = getStyleDef(myEntry.style);
            return s ? (
              <>
                <p className="text-xs text-purple-600 font-medium mb-1">你的決策風格</p>
                <p className="text-sm font-bold text-purple-900">
                  {s.emoji} {s.label}
                </p>
                <p className="text-xs text-purple-600 mt-0.5">{s.desc}</p>
              </>
            ) : null;
          })()}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ds-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-purple-500 text-white rounded text-sm"
        >
          揭示全隊決策風格
        </button>
      )}

      {state.revealed && (
        <div data-testid="ds-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">⚖️ 全隊決策風格分布</p>
          {total === 0 ? (
            <p data-testid="ds-empty" className="text-gray-400 text-sm">
              尚無選擇
            </p>
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
                      data-testid={`ds-bar-${s.id}`}
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

              <div data-testid="ds-member-list" className="space-y-1 pt-2 border-t">
                {state.entries.map((e) => {
                  const s = getStyleDef(e.style);
                  return (
                    <div
                      key={e.entryId}
                      data-testid={`ds-card-${e.entryId}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${s?.dot ?? "bg-gray-300"}`}
                      />
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

export default DecisionStyle;
