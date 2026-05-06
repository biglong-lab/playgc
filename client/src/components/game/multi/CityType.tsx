import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface CityEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  city: string;
  reason: string;
}

interface CityTypeState extends Record<string, unknown> {
  entries: CityEntry[];
  revealed: boolean;
}

interface CityTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): CityTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const CITIES = [
  { id: "tokyo", label: "東京", emoji: "🗼", desc: "精緻有序效率超高" },
  { id: "paris", label: "巴黎", emoji: "🗽", desc: "優雅浪漫重視美感" },
  { id: "nyc", label: "紐約", emoji: "🏙️", desc: "快節奏直接敢拼搏" },
  { id: "bali", label: "峇里島", emoji: "🌴", desc: "放鬆靈性與自然共存" },
  { id: "london", label: "倫敦", emoji: "🎡", desc: "紳士沉穩歷史底蘊" },
  { id: "singapore", label: "新加坡", emoji: "🦁", desc: "務實國際高標準" },
  { id: "barcelona", label: "巴塞隆納", emoji: "⛵", desc: "熱情創意愛享樂" },
  { id: "kyoto", label: "京都", emoji: "⛩️", desc: "傳統細膩靜心修行" },
  { id: "iceland", label: "冰島", emoji: "🌌", desc: "獨特神秘愛探索" },
  { id: "sydney", label: "雪梨", emoji: "🦘", desc: "陽光開朗熱愛戶外" },
];

const CARD_COLORS = [
  "border-l-sky-400 bg-sky-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-indigo-400 bg-indigo-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-purple-400 bg-purple-50",
  "border-l-fuchsia-400 bg-fuchsia-50",
  "border-l-pink-400 bg-pink-50",
  "border-l-rose-400 bg-rose-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CityType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<CityTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "city_type",
    defaultState: { entries: [], revealed: false },
  });

  const [city, setCity] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="cty-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as CityEntry[]).find((e) => e.userId === userId);
  const canSubmit = city !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: CityEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      city,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as CityEntry[]), entry] });
    setCity("");
    setReason("");
  };

  const entries = state.entries as CityEntry[];
  const revealed = state.revealed as boolean;

  const cityCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.city] = (acc[e.city] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="cty-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種城市"}
      </div>
      <div data-testid="cty-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一座城市，你最像哪一個？說說你的氣質原因！"}
      </div>
      <div data-testid="cty-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="cty-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-2">
            {CITIES.map((c) => (
              <button
                key={c.id}
                data-testid={`cty-city-${c.id}`}
                onClick={() => setCity(c.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${city === c.id ? "border-sky-500 bg-sky-50 font-semibold" : "hover:border-sky-400"}`}
              >
                <span className="text-xl shrink-0">{c.emoji}</span>
                <div className="text-left">
                  <div className="font-medium">{c.label}</div>
                  <div className="text-muted-foreground text-[10px]">{c.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="cty-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這座城市最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="cty-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-sky-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            出發！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="cty-my-entry" className="bg-sky-50 rounded-xl p-3 border border-sky-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{CITIES.find((c) => c.id === myEntry.city)?.emoji}</span>
            <span className="text-sm font-semibold">{CITIES.find((c) => c.id === myEntry.city)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已抵達</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="cty-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-sky-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊世界地圖
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="cty-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇城市
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="cty-result" className="flex flex-col gap-3">
          <div data-testid="cty-city-summary" className="flex flex-wrap gap-2">
            {CITIES.filter((c) => cityCounts[c.id] > 0).map((c) => (
              <div
                key={c.id}
                data-testid={`cty-badge-${c.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold"
              >
                {c.emoji} {c.label}
                <span className="ml-1 bg-sky-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {cityCounts[c.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="cty-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const c = CITIES.find((x) => x.id === e.city);
              return (
                <div
                  key={e.entryId}
                  data-testid={`cty-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{c?.emoji}</span>
                    <span className="text-sm font-semibold">{c?.label}</span>
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
