import { useState } from "react";
import { Sliders, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SliderEntry {
  entryId: string;
  userId: string;
  userName: string;
  value: number;
}

interface OpinionSliderState extends Record<string, unknown> {
  entries: SliderEntry[];
  revealed: boolean;
}

interface OpinionSliderConfig {
  title: string;
  question: string;
  leftLabel: string;
  rightLabel: string;
}

function extractConfig(raw: Record<string, unknown>): OpinionSliderConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "意見滑桿",
    question: typeof raw.question === "string" ? raw.question : "你在這個議題上的立場在哪裡？",
    leftLabel: typeof raw.leftLabel === "string" ? raw.leftLabel : "完全不同意",
    rightLabel: typeof raw.rightLabel === "string" ? raw.rightLabel : "完全同意",
  };
}

const DEFAULT_STATE: OpinionSliderState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function OpinionSlider({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<OpinionSliderState>({
    gameId,
    sessionId,
    pageId,
    type: "opinion_slider",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [sliderVal, setSliderVal] = useState(50);

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="os-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    const entry: SliderEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      value: sliderVal,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const avgValue = state.entries.length > 0
    ? Math.round(state.entries.reduce((sum, e) => sum + e.value, 0) / state.entries.length)
    : 50;

  function positionLabel(v: number) {
    if (v <= 20) return cfg.leftLabel;
    if (v >= 80) return cfg.rightLabel;
    if (v < 50) return "略偏左";
    if (v > 50) return "略偏右";
    return "中間";
  }

  function dotColor(v: number) {
    if (v <= 33) return "bg-blue-400";
    if (v >= 67) return "bg-rose-400";
    return "bg-gray-400";
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sliders className="w-5 h-5 text-indigo-500" />
        <h2 className="text-xl font-bold" data-testid="os-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-700 font-medium" data-testid="os-question">{cfg.question}</p>
      <p className="text-xs text-gray-400" data-testid="os-count">已回應：{state.entries.length} 人</p>

      {!myEntry ? (
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-gray-500 px-1">
            <span data-testid="os-left-label">{cfg.leftLabel}</span>
            <span data-testid="os-right-label">{cfg.rightLabel}</span>
          </div>
          <input
            data-testid="os-slider"
            type="range"
            min={0}
            max={100}
            value={sliderVal}
            onChange={(e) => setSliderVal(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <p className="text-center text-sm text-indigo-700 font-medium">
            {positionLabel(sliderVal)}（{sliderVal}）
          </p>
          <button
            data-testid="os-submit-btn"
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-500 text-white rounded text-sm"
          >
            送出立場
          </button>
        </div>
      ) : (
        <div className="p-3 bg-indigo-50 rounded border border-indigo-200 text-sm" data-testid="os-my-entry">
          我的立場：{positionLabel(myEntry.value)}（{myEntry.value}/100）
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="os-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊立場
        </button>
      )}

      {state.revealed && (
        <div data-testid="os-result" className="space-y-3">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{cfg.leftLabel}</span>
            <span>{cfg.rightLabel}</span>
          </div>
          <div className="relative h-4 bg-gradient-to-r from-blue-100 via-gray-100 to-rose-100 rounded-full">
            <div
              data-testid="os-avg-marker"
              className="absolute top-0 w-1 h-4 bg-gray-600 rounded-full transform -translate-x-1/2"
              style={{ left: `${avgValue}%` }}
            />
            {state.entries.map((entry) => (
              <div
                key={entry.entryId}
                data-testid={`os-dot-${entry.entryId}`}
                title={`${entry.userName}: ${entry.value}`}
                className={`absolute top-0.5 w-3 h-3 rounded-full opacity-70 transform -translate-x-1/2 ${dotColor(entry.value)}`}
                style={{ left: `${entry.value}%` }}
              />
            ))}
          </div>
          <p className="text-xs text-center text-gray-500">
            平均立場：{positionLabel(avgValue)}（{avgValue}/100）
          </p>
          {state.entries.length === 0 && (
            <p data-testid="os-empty" className="text-gray-400 text-sm">尚無資料</p>
          )}
        </div>
      )}
    </div>
  );
}

export default OpinionSlider;
