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

interface MoodWeatherState extends Record<string, unknown> {
  entries: WeatherEntry[];
  revealed: boolean;
}

interface MoodWeatherConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): MoodWeatherConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const WEATHERS = [
  { id: "sunny", label: "大晴天", emoji: "☀️", desc: "充滿能量活力" },
  { id: "partly_cloudy", label: "部分晴", emoji: "🌤️", desc: "大致不錯偶有雜念" },
  { id: "cloudy", label: "陰天", emoji: "⛅", desc: "平靜沉穩思考中" },
  { id: "drizzle", label: "毛毛雨", emoji: "🌦️", desc: "有點悶悶的" },
  { id: "rain", label: "下雨天", emoji: "🌧️", desc: "需要充電靜一靜" },
  { id: "thunder", label: "大雷雨", emoji: "⛈️", desc: "情緒波動能量強烈" },
  { id: "rainbow", label: "雨後彩虹", emoji: "🌈", desc: "度過低潮重新出發" },
  { id: "wind", label: "強風", emoji: "🌬️", desc: "快速移動充滿變化" },
  { id: "snow", label: "下雪", emoji: "❄️", desc: "寧靜純粹的白天" },
  { id: "fog", label: "起霧", emoji: "🌫️", desc: "方向有點不清晰" },
];

const CARD_COLORS = [
  "border-l-sky-400 bg-sky-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-blue-400 bg-blue-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function MoodWeather({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MoodWeatherState>({
    gameId,
    sessionId,
    pageId,
    type: "mood_weather",
    defaultState: { entries: [], revealed: false },
  });

  const [weather, setWeather] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="mw-loading">
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
      <div data-testid="mw-title" className="text-xl font-bold text-center">
        {cfg.title ?? "今日心情天氣"}
      </div>
      <div data-testid="mw-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你今天的心情是一種天氣，你會是哪種？說說原因！"}
      </div>
      <div data-testid="mw-count" className="text-xs text-center text-muted-foreground">
        已回報 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="mw-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-2">
            {WEATHERS.map((w) => (
              <button
                key={w.id}
                data-testid={`mw-weather-${w.id}`}
                onClick={() => setWeather(w.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${weather === w.id ? "border-sky-400 bg-sky-50 font-semibold" : "hover:border-sky-300"}`}
              >
                <span className="text-xl shrink-0">{w.emoji}</span>
                <div className="text-left">
                  <div className="font-medium">{w.label}</div>
                  <div className="text-muted-foreground text-[10px]">{w.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="mw-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼今天是這種天氣？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="mw-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-sky-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            送出天氣預報！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="mw-my-entry" className="bg-sky-50 rounded-xl p-3 border border-sky-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{WEATHERS.find((w) => w.id === myEntry.weather)?.emoji}</span>
            <span className="text-sm font-semibold">{WEATHERS.find((w) => w.id === myEntry.weather)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已回報</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="mw-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-sky-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊天氣地圖
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="mw-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人回報天氣
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="mw-result" className="flex flex-col gap-3">
          <div data-testid="mw-weather-summary" className="flex flex-wrap gap-2">
            {WEATHERS.filter((w) => weatherCounts[w.id] > 0).map((w) => (
              <div
                key={w.id}
                data-testid={`mw-badge-${w.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold"
              >
                {w.emoji} {w.label}
                <span className="ml-1 bg-sky-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {weatherCounts[w.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="mw-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const w = WEATHERS.find((x) => x.id === e.weather);
              return (
                <div
                  key={e.entryId}
                  data-testid={`mw-card-${e.entryId}`}
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
