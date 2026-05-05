import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ValuesEntry {
  entryId: string;
  userId: string;
  userName: string;
  selectedValues: string[];
}

interface ValuesCardState extends Record<string, unknown> {
  entries: ValuesEntry[];
  revealed: boolean;
}

interface ValuesCardConfig {
  title: string;
  prompt: string;
  values: string[];
  maxSelect: number;
}

const DEFAULT_VALUES = [
  "誠信", "創新", "合作", "責任", "勇氣",
  "同理心", "成長", "卓越", "多元", "服務",
  "樂趣", "平衡", "影響力", "信任", "學習",
  "熱情",
];

function extractConfig(raw: Record<string, unknown>): ValuesCardConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "價值觀卡",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "從以下選項中，選出最能代表你的 3 個核心價值觀。",
    values: Array.isArray(raw.values) ? (raw.values as string[]) : DEFAULT_VALUES,
    maxSelect: typeof raw.maxSelect === "number" ? raw.maxSelect : 3,
  };
}

const VALUE_COLORS = [
  "bg-rose-100 text-rose-700 border-rose-300",
  "bg-orange-100 text-orange-700 border-orange-300",
  "bg-amber-100 text-amber-700 border-amber-300",
  "bg-lime-100 text-lime-700 border-lime-300",
  "bg-emerald-100 text-emerald-700 border-emerald-300",
  "bg-sky-100 text-sky-700 border-sky-300",
  "bg-violet-100 text-violet-700 border-violet-300",
  "bg-pink-100 text-pink-700 border-pink-300",
];

const DEFAULT_STATE: ValuesCardState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ValuesCard({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<ValuesCardState>({
    gameId,
    sessionId,
    pageId,
    type: "values_card",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="vc-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function toggleValue(v: string) {
    setSelected((prev) => {
      if (prev.includes(v)) return prev.filter((x) => x !== v);
      if (prev.length >= cfg.maxSelect) return prev;
      return [...prev, v];
    });
  }

  function handleSubmit() {
    if (selected.length === 0) return;
    const entry: ValuesEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      selectedValues: selected,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function colorForValue(v: string) {
    const idx = cfg.values.indexOf(v) % VALUE_COLORS.length;
    return VALUE_COLORS[idx >= 0 ? idx : 0];
  }

  function frequencyFor(v: string) {
    return state.entries.filter((e) => e.selectedValues.includes(v)).length;
  }

  const maxFreq = Math.max(...cfg.values.map(frequencyFor), 1);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Heart className="w-5 h-5 text-rose-500" />
        <h2 className="text-xl font-bold" data-testid="vc-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="vc-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="vc-count">已選擇：{state.entries.length} 人</p>

      {!myEntry ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">已選 {selected.length}/{cfg.maxSelect}</p>
          <div className="flex flex-wrap gap-2" data-testid="vc-grid">
            {cfg.values.map((v) => {
              const isSelected = selected.includes(v);
              const maxed = selected.length >= cfg.maxSelect && !isSelected;
              return (
                <button
                  key={v}
                  data-testid={`vc-value-${v}`}
                  onClick={() => toggleValue(v)}
                  disabled={maxed}
                  className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                    isSelected
                      ? `${colorForValue(v)} ring-2 ring-offset-1 ring-rose-300 shadow`
                      : maxed
                      ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                      : "bg-white text-gray-600 border-gray-300 hover:border-rose-300"
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </div>
          <button
            data-testid="vc-submit-btn"
            disabled={selected.length === 0}
            onClick={handleSubmit}
            className="px-4 py-2 bg-rose-500 text-white rounded disabled:opacity-40 text-sm"
          >
            送出我的價值觀
          </button>
        </div>
      ) : (
        <div className="p-3 bg-rose-50 rounded border border-rose-200 text-sm space-y-2" data-testid="vc-my-entry">
          <p className="text-rose-700 font-medium text-xs">我的選擇</p>
          <div className="flex flex-wrap gap-1.5">
            {myEntry.selectedValues.map((v) => (
              <span key={v} className={`px-2 py-0.5 rounded-full border text-xs ${colorForValue(v)}`}>
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="vc-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示團隊價值觀
        </button>
      )}

      {state.revealed && (
        <div data-testid="vc-result" className="space-y-2">
          <p className="text-sm font-semibold text-gray-600">全隊價值觀分佈</p>
          {state.entries.length === 0 ? (
            <p data-testid="vc-empty" className="text-gray-400 text-sm">尚無資料</p>
          ) : (
            <div className="space-y-1.5">
              {cfg.values
                .map((v) => ({ v, freq: frequencyFor(v) }))
                .filter(({ freq }) => freq > 0)
                .sort((a, b) => b.freq - a.freq)
                .map(({ v, freq }) => (
                  <div key={v} data-testid={`vc-bar-${v}`} className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full border text-xs w-20 text-center shrink-0 ${colorForValue(v)}`}>
                      {v}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-rose-400 rounded-full h-2 transition-all"
                        style={{ width: `${(freq / maxFreq) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-6 text-right">{freq}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ValuesCard;
