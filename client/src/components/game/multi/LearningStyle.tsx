import { Loader2, BookOpen } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface StyleEntry {
  entryId: string;
  userId: string;
  userName: string;
  style: string;
}

interface LearningStyleState extends Record<string, unknown> {
  entries: StyleEntry[];
  revealed: boolean;
}

interface LearningStyleConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): LearningStyleConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "學習風格",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "你最容易吸收知識的方式是哪一種？",
  };
}

const STYLES = [
  {
    id: "visual",
    label: "視覺型",
    emoji: "👁️",
    desc: "喜歡圖表、顏色、空間排列，圖像讓我記得更牢",
    color: "border-purple-400 bg-purple-50 text-purple-800",
    dot: "bg-purple-400",
  },
  {
    id: "auditory",
    label: "聽覺型",
    emoji: "👂",
    desc: "討論、說出來或聽別人講，我學得最快",
    color: "border-blue-400 bg-blue-50 text-blue-800",
    dot: "bg-blue-400",
  },
  {
    id: "reading",
    label: "閱讀型",
    emoji: "📖",
    desc: "讀文章、做筆記、整理清單，文字是我的語言",
    color: "border-green-400 bg-green-50 text-green-800",
    dot: "bg-green-400",
  },
  {
    id: "kinesthetic",
    label: "動覺型",
    emoji: "🤲",
    desc: "動手做、親身體驗，實作才是真正的學習",
    color: "border-orange-400 bg-orange-50 text-orange-800",
    dot: "bg-orange-400",
  },
] as const;

const DEFAULT_STATE: LearningStyleState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function LearningStyle({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<LearningStyleState>({
    gameId,
    sessionId,
    pageId,
    type: "learning_style",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="ls-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSelect(styleId: string) {
    const entry: StyleEntry = {
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
        <BookOpen className="w-5 h-5 text-green-600" />
        <h2 className="text-xl font-bold" data-testid="ls-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="ls-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="ls-count">
        已選擇：{total} 人
      </p>

      {!myEntry ? (
        <div data-testid="ls-form" className="space-y-2">
          <p className="text-xs text-gray-500">點選最符合你的學習方式</p>
          {STYLES.map((s) => (
            <button
              key={s.id}
              data-testid={`ls-style-${s.id}`}
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
          className="p-3 bg-green-50 rounded border border-green-200 text-sm"
          data-testid="ls-my-entry"
        >
          {(() => {
            const s = getStyleDef(myEntry.style);
            return s ? (
              <>
                <p className="text-xs text-green-700 font-medium mb-1">你的學習風格</p>
                <p className="text-sm font-bold text-green-900">
                  {s.emoji} {s.label}
                </p>
                <p className="text-xs text-green-600 mt-0.5">{s.desc}</p>
              </>
            ) : null;
          })()}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ls-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-600 text-white rounded text-sm"
        >
          揭示全隊學習風格
        </button>
      )}

      {state.revealed && (
        <div data-testid="ls-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">📚 全隊學習風格分布</p>
          {total === 0 ? (
            <p data-testid="ls-empty" className="text-gray-400 text-sm">
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
                      data-testid={`ls-bar-${s.id}`}
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

              <div data-testid="ls-member-list" className="space-y-1 pt-2 border-t">
                {state.entries.map((e) => {
                  const s = getStyleDef(e.style);
                  return (
                    <div
                      key={e.entryId}
                      data-testid={`ls-card-${e.entryId}`}
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

export default LearningStyle;
