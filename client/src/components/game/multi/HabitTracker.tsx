import { useState } from "react";
import { Repeat, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface HabitEntry {
  entryId: string;
  userId: string;
  userName: string;
  habit: string;
  category: string;
  why: string;
}

interface HabitTrackerState extends Record<string, unknown> {
  entries: HabitEntry[];
  revealed: boolean;
}

interface HabitTrackerConfig {
  title: string;
  prompt: string;
  habitPlaceholder: string;
  whyPlaceholder: string;
  categories: string[];
}

const DEFAULT_CATEGORIES = ["健康", "學習", "工作", "人際", "財務", "創意", "其他"];

function extractConfig(raw: Record<string, unknown>): HabitTrackerConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "習慣追蹤",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "你最想建立的一個新習慣是什麼？",
    habitPlaceholder:
      typeof raw.habitPlaceholder === "string"
        ? raw.habitPlaceholder
        : "例如：每天閱讀 30 分鐘",
    whyPlaceholder:
      typeof raw.whyPlaceholder === "string"
        ? raw.whyPlaceholder
        : "為什麼這個習慣對你重要？（選填）",
    categories: Array.isArray(raw.categories)
      ? (raw.categories as string[])
      : DEFAULT_CATEGORIES,
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  健康: "bg-green-100 text-green-700",
  學習: "bg-blue-100 text-blue-700",
  工作: "bg-amber-100 text-amber-700",
  人際: "bg-pink-100 text-pink-700",
  財務: "bg-yellow-100 text-yellow-700",
  創意: "bg-purple-100 text-purple-700",
  其他: "bg-gray-100 text-gray-700",
};

const DEFAULT_STATE: HabitTrackerState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function HabitTracker({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<HabitTrackerState>({
    gameId,
    sessionId,
    pageId,
    type: "habit_tracker",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [habit, setHabit] = useState("");
  const [category, setCategory] = useState(cfg.categories[0] ?? "其他");
  const [why, setWhy] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="ht-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = habit.trim().length >= 3;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: HabitEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      habit: habit.trim(),
      category,
      why: why.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const catFreq: Record<string, number> = {};
  state.entries.forEach((e) => {
    catFreq[e.category] = (catFreq[e.category] ?? 0) + 1;
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Repeat className="w-5 h-5 text-green-600" />
        <h2 className="text-xl font-bold" data-testid="ht-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="ht-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="ht-count">
        已分享：{state.entries.length} 人
      </p>

      {!myEntry ? (
        <div className="space-y-4" data-testid="ht-form">
          <div>
            <p className="text-xs text-gray-500 mb-1">類別</p>
            <div className="flex flex-wrap gap-2" data-testid="ht-categories">
              {cfg.categories.map((cat) => (
                <button
                  key={cat}
                  data-testid={`ht-cat-${cat}`}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs transition-all border ${
                    category === cat
                      ? "border-green-500 font-semibold " + (CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-700")
                      : "border-gray-200 bg-white text-gray-500 hover:border-green-300"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <textarea
            data-testid="ht-habit-input"
            className="w-full border rounded p-2 text-sm resize-none"
            rows={2}
            placeholder={cfg.habitPlaceholder}
            maxLength={80}
            value={habit}
            onChange={(e) => setHabit(e.target.value)}
          />

          <textarea
            data-testid="ht-why-input"
            className="w-full border rounded p-2 text-sm resize-none"
            rows={2}
            placeholder={cfg.whyPlaceholder}
            maxLength={80}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
          />

          <button
            data-testid="ht-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-40 text-sm"
          >
            分享習慣
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-green-50 rounded border border-green-200 text-sm space-y-1"
          data-testid="ht-my-entry"
        >
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[myEntry.category] ?? "bg-gray-100 text-gray-700"}`}
          >
            {myEntry.category}
          </span>
          <p className="font-medium text-gray-800 mt-1">🔄 {myEntry.habit}</p>
          {myEntry.why && (
            <p className="text-xs text-gray-500 italic">「{myEntry.why}」</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ht-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊習慣
        </button>
      )}

      {state.revealed && (
        <div data-testid="ht-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">🔄 全隊習慣清單</p>
          {state.entries.length === 0 ? (
            <p data-testid="ht-empty" className="text-gray-400 text-sm">
              尚無分享
            </p>
          ) : (
            <div className="space-y-2">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  data-testid={`ht-card-${entry.entryId}`}
                  className="p-3 bg-white border rounded shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[entry.category] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {entry.category}
                    </span>
                    <span className="text-xs text-gray-500">{entry.userName}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 mt-1">{entry.habit}</p>
                  {entry.why && (
                    <p className="text-xs text-gray-400 italic mt-0.5">「{entry.why}」</p>
                  )}
                </div>
              ))}
              <div data-testid="ht-cat-stats" className="space-y-1 pt-2 border-t">
                <p className="text-xs font-medium text-gray-500">類別統計</p>
                {Object.entries(catFreq)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
                    <div key={cat} className="flex justify-between text-xs text-gray-600">
                      <span className={`px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat] ?? "bg-gray-100"}`}>{cat}</span>
                      <span className="font-medium">{count} 人</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HabitTracker;
