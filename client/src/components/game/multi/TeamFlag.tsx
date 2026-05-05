import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface FlagEntry {
  entryId: string;
  userId: string;
  userName: string;
  words: string[];
}

interface TeamFlagState extends Record<string, unknown> {
  entries: FlagEntry[];
  revealed: boolean;
}

interface TeamFlagConfig {
  title: string;
  prompt: string;
  maxWords: number;
  suggestions: string[];
}

function extractConfig(raw: Record<string, unknown>): TeamFlagConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "團隊旗幟",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "選或輸入最多 3 個詞，代表這個團隊的文化或精神：",
    maxWords: typeof raw.maxWords === "number" ? raw.maxWords : 3,
    suggestions: Array.isArray(raw.suggestions)
      ? (raw.suggestions as string[])
      : [
          "創新", "合作", "信任", "熱情", "效率",
          "包容", "勇氣", "誠信", "彈性", "專注",
          "開放", "成長", "樂趣", "責任", "共贏",
        ],
  };
}

const WORD_COLORS = [
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-violet-100 text-violet-700 border-violet-200",
  "bg-sky-100 text-sky-700 border-sky-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-teal-100 text-teal-700 border-teal-200",
];

const DEFAULT_STATE: TeamFlagState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamFlag({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamFlagState>({
    gameId,
    sessionId,
    pageId,
    type: "team_flag",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="tf-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = selected.length > 0;

  function toggleWord(word: string) {
    setSelected((prev) => {
      if (prev.includes(word)) return prev.filter((w) => w !== word);
      if (prev.length >= cfg.maxWords) return prev;
      return [...prev, word];
    });
  }

  function addCustom() {
    const word = custom.trim();
    if (!word || selected.length >= cfg.maxWords || selected.includes(word)) return;
    setSelected((prev) => [...prev, word]);
    setCustom("");
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: FlagEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      words: [...selected],
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function wordFrequency() {
    const freq: Record<string, number> = {};
    state.entries.forEach((e) =>
      e.words.forEach((w) => {
        freq[w] = (freq[w] ?? 0) + 1;
      })
    );
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Flag className="w-5 h-5 text-rose-500" />
        <h2 className="text-xl font-bold" data-testid="tf-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="tf-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="tf-count">
        已提交：{state.entries.length} 人
      </p>

      {!myEntry ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" data-testid="tf-suggestions">
            {cfg.suggestions.map((word) => (
              <button
                key={word}
                data-testid={`tf-suggest-${word}`}
                onClick={() => toggleWord(word)}
                className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                  selected.includes(word)
                    ? "bg-rose-500 text-white border-rose-500 shadow-md"
                    : "bg-white text-gray-600 border-gray-200 hover:border-rose-300"
                }`}
              >
                {word}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              data-testid="tf-custom-input"
              className="flex-1 border rounded p-2 text-sm"
              placeholder={`自訂詞（已選 ${selected.length}/${cfg.maxWords}）`}
              maxLength={10}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <button
              data-testid="tf-add-btn"
              onClick={addCustom}
              disabled={!custom.trim() || selected.length >= cfg.maxWords}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm disabled:opacity-40"
            >
              加入
            </button>
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1" data-testid="tf-selected">
              {selected.map((w) => (
                <span
                  key={w}
                  className="px-2 py-1 bg-rose-50 border border-rose-200 rounded-full text-xs text-rose-700 font-medium"
                >
                  {w}
                </span>
              ))}
            </div>
          )}
          <button
            data-testid="tf-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-rose-500 text-white rounded disabled:opacity-40 text-sm"
          >
            舉旗！
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-rose-50 rounded border border-rose-200 text-sm flex flex-wrap gap-1"
          data-testid="tf-my-entry"
        >
          {myEntry.words.map((w) => (
            <span
              key={w}
              className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-medium border border-rose-200"
            >
              {w}
            </span>
          ))}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="tf-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊旗幟
        </button>
      )}

      {state.revealed && (
        <div data-testid="tf-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">🏴 團隊精神詞雲</p>
          {state.entries.length === 0 ? (
            <p data-testid="tf-empty" className="text-gray-400 text-sm">
              尚無資料
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {wordFrequency().map(([word, count], i) => (
                <span
                  key={word}
                  data-testid={`tf-word-${word}`}
                  className={`px-3 py-1.5 rounded-full border text-sm font-medium ${WORD_COLORS[i % WORD_COLORS.length]}`}
                  style={{ fontSize: `${Math.min(0.7 + count * 0.15, 1.4)}rem` }}
                >
                  {word}
                  <sup className="text-xs ml-0.5">{count}</sup>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TeamFlag;
