import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface WeatherEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  weather: string;
  reason: string;
}

interface WeatherTypeState extends Record<string, unknown> {
  entries: WeatherEntry[];
  revealed: boolean;
}

interface WeatherTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): WeatherTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const WEATHERS = [
  { id: "sunny", label: "晴天", emoji: "☀️", desc: "樂觀開朗充滿活力" },
  { id: "cloudy", label: "陰天", emoji: "☁️", desc: "沉穩低調深思熟慮" },
  { id: "rainy", label: "雨天", emoji: "🌧️", desc: "細膩敏感重視情感" },
  { id: "stormy", label: "暴風雨", emoji: "⛈️", desc: "爆發力強改變一切" },
  { id: "snowy", label: "下雪", emoji: "❄️", desc: "純粹安靜讓人放慢" },
  { id: "foggy", label: "霧天", emoji: "🌫️", desc: "神秘難以捉摸引人" },
  { id: "rainbow", label: "彩虹", emoji: "🌈", desc: "多彩帶來希望驚喜" },
  { id: "windy", label: "大風天", emoji: "💨", desc: "自由奔放帶動改變" },
  { id: "aurora", label: "極光", emoji: "🌌", desc: "夢幻稀有讓人難忘" },
];

const CARD_COLORS = [
  "border-l-sky-400 bg-sky-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-cyan-400 bg-cyan-50",
  "border-l-indigo-400 bg-indigo-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-purple-400 bg-purple-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-amber-400 bg-amber-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function WeatherType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<WeatherTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "weather_type",
    defaultState: { entries: [], revealed: false },
  });

  const [weather, setWeather] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="wth-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as WeatherEntry[]).find((e) => e.userId === userId);
  const canSubmit = weather !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: WeatherEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      weather,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as WeatherEntry[]), entry] });
    setWeather("");
    setReason("");
  };

  const entries = state.entries as WeatherEntry[];
  const revealed = state.revealed as boolean;

  const weatherCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.weather] = (acc[e.weather] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="wth-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種天氣"}
      </div>
      <div data-testid="wth-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種天氣，你最像哪一種？說說你的天氣個性！"}
      </div>
      <div data-testid="wth-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="wth-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {WEATHERS.map((w) => (
              <button
                key={w.id}
                data-testid={`wth-weather-${w.id}`}
                onClick={() => setWeather(w.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${weather === w.id ? "border-sky-500 bg-sky-50 font-semibold" : "hover:border-sky-400"}`}
              >
                <span className="text-2xl">{w.emoji}</span>
                <div className="font-medium text-center">{w.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{w.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="wth-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種天氣最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="wth-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-sky-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            報天氣！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="wth-my-entry" className="bg-sky-50 rounded-xl p-3 border border-sky-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{WEATHERS.find((w) => w.id === myEntry.weather)?.emoji}</span>
            <span className="text-sm font-semibold">{WEATHERS.find((w) => w.id === myEntry.weather)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已預報</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="wth-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-sky-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊天氣圖
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="wth-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇天氣
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="wth-result" className="flex flex-col gap-3">
          <div data-testid="wth-weather-summary" className="flex flex-wrap gap-2">
            {WEATHERS.filter((w) => weatherCounts[w.id] > 0).map((w) => (
              <div
                key={w.id}
                data-testid={`wth-badge-${w.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold"
              >
                {w.emoji} {w.label}
                <span className="ml-1 bg-sky-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {weatherCounts[w.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="wth-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const w = WEATHERS.find((x) => x.id === e.weather);
              return (
                <div
                  key={e.entryId}
                  data-testid={`wth-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{w?.emoji}</span>
                    <span className="text-sm font-semibold">{w?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.reason}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
