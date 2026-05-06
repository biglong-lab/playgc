import { useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface WisdomEntry {
  entryId: string;
  userId: string;
  userName: string;
  wisdom: string;
  source: string;
  tag: string;
}

interface WisdomPoolState extends Record<string, unknown> {
  entries: WisdomEntry[];
  revealed: boolean;
}

interface WisdomPoolConfig {
  title: string;
  prompt: string;
  wisdomPlaceholder: string;
  sourcePlaceholder: string;
  tags: string[];
}

const DEFAULT_TAGS = ["人生智慧", "工作心得", "領導力", "溝通技巧", "創新思維", "失敗教訓", "成功秘訣"];

function extractConfig(raw: Record<string, unknown>): WisdomPoolConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "智慧池",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "分享一句改變你思維或行動的智慧話語：",
    wisdomPlaceholder:
      typeof raw.wisdomPlaceholder === "string"
        ? raw.wisdomPlaceholder
        : "這句話是什麼？（≥5字）",
    sourcePlaceholder:
      typeof raw.sourcePlaceholder === "string"
        ? raw.sourcePlaceholder
        : "來源：書籍、前輩、親身體驗…（選填）",
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : DEFAULT_TAGS,
  };
}

const DEFAULT_STATE: WisdomPoolState = { entries: [], revealed: false };

const TAG_COLORS: Record<string, string> = {
  "人生智慧": "bg-purple-100 text-purple-700",
  "工作心得": "bg-blue-100 text-blue-700",
  "領導力": "bg-amber-100 text-amber-700",
  "溝通技巧": "bg-green-100 text-green-700",
  "創新思維": "bg-pink-100 text-pink-700",
  "失敗教訓": "bg-red-100 text-red-700",
  "成功秘訣": "bg-teal-100 text-teal-700",
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function WisdomPool({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<WisdomPoolState>({
    gameId,
    sessionId,
    pageId,
    type: "wisdom_pool",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [wisdom, setWisdom] = useState("");
  const [source, setSource] = useState("");
  const [tag, setTag] = useState(cfg.tags[0] ?? "人生智慧");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="wp-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = wisdom.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: WisdomEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      wisdom: wisdom.trim(),
      source: source.trim(),
      tag,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const tagFreq: Record<string, number> = {};
  state.entries.forEach((e) => {
    tagFreq[e.tag] = (tagFreq[e.tag] ?? 0) + 1;
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-purple-500" />
        <h2 className="text-xl font-bold" data-testid="wp-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="wp-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="wp-count">
        已貢獻：{state.entries.length} 條智慧
      </p>

      {!myEntry ? (
        <div className="space-y-4" data-testid="wp-form">
          <div>
            <p className="text-xs text-gray-500 mb-1">選擇類別</p>
            <div className="flex flex-wrap gap-2" data-testid="wp-tags">
              {cfg.tags.map((t) => (
                <button
                  key={t}
                  data-testid={`wp-tag-${t}`}
                  onClick={() => setTag(t)}
                  className={`px-2 py-1 rounded-full text-xs transition-all border ${
                    tag === t
                      ? "border-purple-400 font-semibold " + (TAG_COLORS[t] ?? "bg-gray-100 text-gray-700")
                      : "border-gray-200 bg-white text-gray-500 hover:border-purple-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <textarea
            data-testid="wp-wisdom-input"
            className="w-full border rounded p-2 text-sm resize-none"
            rows={3}
            placeholder={cfg.wisdomPlaceholder}
            maxLength={100}
            value={wisdom}
            onChange={(e) => setWisdom(e.target.value)}
          />

          <input
            data-testid="wp-source-input"
            className="w-full border rounded p-2 text-sm"
            placeholder={cfg.sourcePlaceholder}
            maxLength={40}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />

          <button
            data-testid="wp-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-40 text-sm"
          >
            投入智慧
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-purple-50 rounded border border-purple-200 text-sm space-y-1"
          data-testid="wp-my-entry"
        >
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${TAG_COLORS[myEntry.tag] ?? "bg-gray-100 text-gray-700"}`}
          >
            {myEntry.tag}
          </span>
          <p className="font-medium text-gray-800 mt-1">💡 「{myEntry.wisdom}」</p>
          {myEntry.source && (
            <p className="text-xs text-gray-400">—— {myEntry.source}</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="wp-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示智慧池
        </button>
      )}

      {state.revealed && (
        <div data-testid="wp-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">💡 集體智慧牆</p>
          {state.entries.length === 0 ? (
            <p data-testid="wp-empty" className="text-gray-400 text-sm">
              尚無智慧
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {state.entries.map((entry) => (
                  <div
                    key={entry.entryId}
                    data-testid={`wp-card-${entry.entryId}`}
                    className="p-3 bg-white border rounded shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${TAG_COLORS[entry.tag] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {entry.tag}
                      </span>
                      <span className="text-xs text-gray-400">{entry.userName}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 mt-1.5">「{entry.wisdom}」</p>
                    {entry.source && (
                      <p className="text-xs text-gray-400 mt-0.5">—— {entry.source}</p>
                    )}
                  </div>
                ))}
              </div>
              {Object.keys(tagFreq).length > 0 && (
                <div data-testid="wp-tag-stats" className="pt-2 border-t space-y-1">
                  <p className="text-xs font-medium text-gray-500">熱門類別</p>
                  {Object.entries(tagFreq)
                    .sort((a, b) => b[1] - a[1])
                    .map(([t, count]) => (
                      <div key={t} className="flex justify-between text-xs">
                        <span className={`px-2 py-0.5 rounded-full ${TAG_COLORS[t] ?? "bg-gray-100"}`}>{t}</span>
                        <span className="text-gray-500">{count} 條</span>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default WisdomPool;
