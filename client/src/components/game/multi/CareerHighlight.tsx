import { useState } from "react";
import { Briefcase, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface HighlightEntry {
  entryId: string;
  userId: string;
  userName: string;
  achievement: string;
  year: string;
  impact: string;
}

interface CareerHighlightState extends Record<string, unknown> {
  entries: HighlightEntry[];
  revealed: boolean;
}

interface CareerHighlightConfig {
  title: string;
  prompt: string;
  achievementPlaceholder: string;
  impactPlaceholder: string;
}

function extractConfig(raw: Record<string, unknown>): CareerHighlightConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "職涯亮點",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "分享你職涯中最自豪的一個成就或轉折點：",
    achievementPlaceholder:
      typeof raw.achievementPlaceholder === "string"
        ? raw.achievementPlaceholder
        : "例如：主導了首次跨部門專案，成功整合三個團隊…",
    impactPlaceholder:
      typeof raw.impactPlaceholder === "string"
        ? raw.impactPlaceholder
        : "這個成就帶來什麼影響或改變？（選填）",
  };
}

const DEFAULT_STATE: CareerHighlightState = { entries: [], revealed: false };

const YEAR_OPTIONS: string[] = Array.from({ length: 11 }, (_, i) =>
  String(new Date().getFullYear() - i)
);

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CareerHighlight({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<CareerHighlightState>({
    gameId,
    sessionId,
    pageId,
    type: "career_highlight",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [achievement, setAchievement] = useState("");
  const [year, setYear] = useState(YEAR_OPTIONS[0] ?? "");
  const [impact, setImpact] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="ch-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = achievement.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: HighlightEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      achievement: achievement.trim(),
      year,
      impact: impact.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const sorted = [...state.entries].sort((a, b) => Number(b.year) - Number(a.year));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-indigo-600" />
        <h2 className="text-xl font-bold" data-testid="ch-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="ch-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="ch-count">
        已分享：{state.entries.length} 人
      </p>

      {!myEntry ? (
        <div className="space-y-4" data-testid="ch-form">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">發生年份</label>
            <select
              data-testid="ch-year-select"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="border rounded p-1.5 text-sm w-28"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <textarea
            data-testid="ch-achievement-input"
            className="w-full border rounded p-2 text-sm resize-none"
            rows={3}
            placeholder={cfg.achievementPlaceholder}
            maxLength={120}
            value={achievement}
            onChange={(e) => setAchievement(e.target.value)}
          />

          <textarea
            data-testid="ch-impact-input"
            className="w-full border rounded p-2 text-sm resize-none"
            rows={2}
            placeholder={cfg.impactPlaceholder}
            maxLength={80}
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
          />

          <button
            data-testid="ch-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-40 text-sm"
          >
            分享亮點
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-indigo-50 rounded border border-indigo-200 text-sm space-y-1"
          data-testid="ch-my-entry"
        >
          <p className="text-xs text-indigo-400 font-medium">{myEntry.year} 年</p>
          <p className="font-medium text-gray-800">⭐ {myEntry.achievement}</p>
          {myEntry.impact && (
            <p className="text-xs text-gray-500 italic">「{myEntry.impact}」</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ch-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示職涯時間軸
        </button>
      )}

      {state.revealed && (
        <div data-testid="ch-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">🏆 職涯亮點時間軸</p>
          {state.entries.length === 0 ? (
            <p data-testid="ch-empty" className="text-gray-400 text-sm">
              尚無分享
            </p>
          ) : (
            <div className="space-y-3">
              {sorted.map((entry) => (
                <div
                  key={entry.entryId}
                  data-testid={`ch-card-${entry.entryId}`}
                  className="flex gap-3"
                >
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {entry.year}
                    </span>
                    <div className="w-px flex-1 bg-indigo-100 mt-1" />
                  </div>
                  <div className="pb-3 flex-1">
                    <p className="text-xs text-gray-500">{entry.userName}</p>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">
                      {entry.achievement}
                    </p>
                    {entry.impact && (
                      <p className="text-xs text-gray-400 italic mt-0.5">
                        「{entry.impact}」
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CareerHighlight;
