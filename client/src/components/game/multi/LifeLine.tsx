import { useState } from "react";
import { TrendingUp, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface LifeEvent {
  year: string;
  event: string;
  impact: "high" | "medium" | "low";
}

interface LifeLineEntry {
  entryId: string;
  userId: string;
  userName: string;
  events: LifeEvent[];
  theme: string;
}

interface LifeLineState extends Record<string, unknown> {
  entries: LifeLineEntry[];
  revealed: boolean;
}

interface LifeLineConfig {
  title: string;
  prompt: string;
  theme: string;
  maxEvents: number;
}

function extractConfig(raw: Record<string, unknown>): LifeLineConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "人生時間軸",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "在你的人生中，哪 3 個時刻最具轉折意義？",
    theme:
      typeof raw.theme === "string"
        ? raw.theme
        : "關鍵時刻",
    maxEvents: typeof raw.maxEvents === "number" ? raw.maxEvents : 3,
  };
}

const DEFAULT_STATE: LifeLineState = { entries: [], revealed: false };

const IMPACT_CONFIG = {
  high: { label: "高影響", color: "bg-rose-500", textColor: "text-rose-600" },
  medium: { label: "中影響", color: "bg-amber-400", textColor: "text-amber-600" },
  low: { label: "低影響", color: "bg-blue-300", textColor: "text-blue-500" },
} as const;

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 51 }, (_, i) => String(CURRENT_YEAR - 50 + i)).reverse();

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function LifeLine({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<LifeLineState>({
    gameId,
    sessionId,
    pageId,
    type: "life_line",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [events, setEvents] = useState<LifeEvent[]>([
    { year: String(CURRENT_YEAR - 5), event: "", impact: "high" },
  ]);

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="ll-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = events.some((e) => e.event.trim().length >= 3);

  function updateEvent(idx: number, field: keyof LifeEvent, value: string) {
    setEvents((prev) =>
      prev.map((e, i) =>
        i === idx ? { ...e, [field]: value } : e
      )
    );
  }

  function addEvent() {
    if (events.length >= cfg.maxEvents) return;
    setEvents((prev) => [
      ...prev,
      { year: String(CURRENT_YEAR - 3), event: "", impact: "medium" },
    ]);
  }

  function removeEvent(idx: number) {
    if (events.length <= 1) return;
    setEvents((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const validEvents = events.filter((e) => e.event.trim().length >= 3);
    const entry: LifeLineEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      events: validEvents.sort((a, b) => Number(a.year) - Number(b.year)),
      theme: cfg.theme,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-teal-600" />
        <h2 className="text-xl font-bold" data-testid="ll-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="ll-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="ll-count">
        已提交：{state.entries.length} 條時間軸
      </p>

      {!myEntry ? (
        <div className="space-y-4" data-testid="ll-form">
          {events.map((ev, idx) => (
            <div
              key={idx}
              data-testid={`ll-event-${idx}`}
              className="p-3 border rounded-lg space-y-2 bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <select
                  data-testid={`ll-year-${idx}`}
                  value={ev.year}
                  onChange={(e) => updateEvent(idx, "year", e.target.value)}
                  className="border rounded p-1 text-sm w-24"
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <div className="flex gap-1">
                  {(["high", "medium", "low"] as const).map((imp) => (
                    <button
                      key={imp}
                      data-testid={`ll-impact-${idx}-${imp}`}
                      onClick={() => updateEvent(idx, "impact", imp)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        ev.impact === imp
                          ? IMPACT_CONFIG[imp].color + " ring-2 ring-offset-1 ring-gray-400"
                          : IMPACT_CONFIG[imp].color + " opacity-30"
                      }`}
                      title={IMPACT_CONFIG[imp].label}
                    />
                  ))}
                </div>
                {events.length > 1 && (
                  <button
                    data-testid={`ll-remove-${idx}`}
                    onClick={() => removeEvent(idx)}
                    className="ml-auto text-xs text-gray-400 hover:text-red-400"
                  >
                    ✕
                  </button>
                )}
              </div>
              <input
                data-testid={`ll-event-input-${idx}`}
                className="w-full border rounded p-2 text-sm"
                placeholder="描述這個關鍵時刻…（≥3字）"
                maxLength={60}
                value={ev.event}
                onChange={(e) => updateEvent(idx, "event", e.target.value)}
              />
            </div>
          ))}

          {events.length < cfg.maxEvents && (
            <button
              data-testid="ll-add-event-btn"
              onClick={addEvent}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-400 hover:border-teal-400 hover:text-teal-500 transition-colors"
            >
              + 新增時刻（最多 {cfg.maxEvents} 個）
            </button>
          )}

          <button
            data-testid="ll-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-4 py-2 bg-teal-600 text-white rounded disabled:opacity-40 text-sm"
          >
            提交時間軸
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-teal-50 rounded border border-teal-200 text-sm"
          data-testid="ll-my-entry"
        >
          <p className="text-xs text-teal-600 font-medium mb-2">你的時間軸</p>
          {myEntry.events.map((ev, idx) => (
            <div key={idx} className="flex gap-2 items-center text-xs text-gray-600 mb-1">
              <span className="font-medium text-teal-700 w-10">{ev.year}</span>
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${IMPACT_CONFIG[ev.impact]?.color ?? "bg-gray-300"}`}
              />
              <span>{ev.event}</span>
            </div>
          ))}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ll-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          揭示全隊時間軸
        </button>
      )}

      {state.revealed && (
        <div data-testid="ll-result" className="space-y-4">
          <p className="text-sm font-semibold text-gray-600">📈 全隊人生時間軸</p>
          {state.entries.length === 0 ? (
            <p data-testid="ll-empty" className="text-gray-400 text-sm">尚無提交</p>
          ) : (
            <div className="space-y-4">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  data-testid={`ll-card-${entry.entryId}`}
                  className="p-3 bg-white border rounded shadow-sm"
                >
                  <p className="text-xs font-semibold text-gray-500 mb-2">{entry.userName}</p>
                  <div className="space-y-1">
                    {entry.events.map((ev, idx) => (
                      <div key={idx} className="flex gap-2 items-center text-xs">
                        <span className="font-medium text-teal-600 w-10">{ev.year}</span>
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${IMPACT_CONFIG[ev.impact]?.color ?? "bg-gray-300"}`}
                        />
                        <span className="text-gray-700">{ev.event}</span>
                      </div>
                    ))}
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

export default LifeLine;
