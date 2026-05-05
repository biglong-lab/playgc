import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface TimelineEvent extends Record<string, unknown> {
  eventId: string;
  userId: string;
  userName: string;
  time: string;
  text: string;
}

export interface EventTimelineConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  timePlaceholder: string;
  maxLength: number;
}

export interface EventTimelineState extends Record<string, unknown> {
  events: TimelineEvent[];
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): EventTimelineConfig {
  return {
    title: (raw.title as string) || "📅 共享時間軸",
    prompt: (raw.prompt as string) || "寫下一個你認為重要的時間點與事件",
    timePlaceholder: (raw.timePlaceholder as string) || "例：2024年、第3個月...",
    maxLength: (raw.maxLength as number) ?? 80,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function EventTimeline({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: EventTimelineState = { events: [], revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<EventTimelineState>({
    gameId,
    sessionId,
    pageId,
    type: "event_timeline",
    defaultState,
  });

  const [time, setTime] = useState("");
  const [text, setText] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="etl-loading" />
      </div>
    );
  }

  const myEvents = state.events.filter((e) => e.userId === userId);

  function handleSubmit() {
    if (!time.trim() || !text.trim()) return;
    const eventId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      events: [...state.events, { eventId, userId, userName, time: time.trim(), text: text.trim() }],
    });
    setTime("");
    setText("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const sorted = [...state.events].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="etl-title">{cfg.title}</h2>
      <p className="text-sm text-gray-500" data-testid="etl-prompt">{cfg.prompt}</p>
      <p className="text-sm text-gray-400" data-testid="etl-count">已加入：{state.events.length} 個事件</p>

      {!state.revealed && (
        <div className="space-y-2">
          <input
            className="w-full border rounded px-3 py-2 text-sm focus:border-blue-400"
            placeholder={cfg.timePlaceholder}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            data-testid="etl-time-input"
          />
          <textarea
            className="w-full border rounded px-3 py-2 h-16 text-sm focus:border-blue-400"
            placeholder="描述這個事件..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={cfg.maxLength}
            data-testid="etl-text-input"
          />
          <button
            className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50 text-sm"
            disabled={!time.trim() || !text.trim()}
            onClick={handleSubmit}
            data-testid="etl-submit-btn"
          >
            加入時間軸
          </button>
        </div>
      )}

      {myEvents.length > 0 && !state.revealed && (
        <div data-testid="etl-my-events">
          <p className="text-xs font-semibold text-gray-500 mb-2">我加入的事件：</p>
          <div className="space-y-1">
            {myEvents.map((ev) => (
              <div key={ev.eventId} className="flex gap-2 text-xs p-2 bg-blue-50 rounded border border-blue-200">
                <span className="font-semibold text-blue-700 whitespace-nowrap">{ev.time}</span>
                <span className="text-gray-700">{ev.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          className="w-full py-2 bg-indigo-600 text-white rounded text-sm"
          onClick={handleReveal}
          data-testid="etl-reveal-btn"
        >
          揭曉時間軸
        </button>
      )}

      {state.revealed && (
        <div data-testid="etl-result">
          <h3 className="font-semibold mb-3 text-sm">📅 完整時間軸</h3>
          {state.events.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-sm" data-testid="etl-empty">沒有人加入事件</p>
          ) : (
            <div className="relative pl-4">
              <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-blue-200" />
              {sorted.map((ev) => (
                <div
                  key={ev.eventId}
                  className="relative mb-4 ml-4"
                  data-testid={`etl-event-${ev.eventId}`}
                >
                  <div className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" />
                  <div className="p-2 border rounded-lg bg-white shadow-sm text-xs">
                    <p className="font-semibold text-blue-700">{ev.time}</p>
                    <p className="text-gray-700 mt-0.5">{ev.text}</p>
                    <p className="text-gray-400 mt-1">👤 {ev.userName}</p>
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

export default EventTimeline;
