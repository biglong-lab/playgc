import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface TravelEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  style: string;
  dream: string;
}

interface TravelStyleState extends Record<string, unknown> {
  entries: TravelEntry[];
  revealed: boolean;
}

interface TravelStyleConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): TravelStyleConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const STYLES = [
  { id: "backpacker", label: "背包客", emoji: "🎒", desc: "隨性出發擁抱未知" },
  { id: "luxury", label: "享樂派", emoji: "🏨", desc: "精品住宿精緻體驗" },
  { id: "adventure", label: "冒險家", emoji: "🧗", desc: "挑戰極限戶外探索" },
  { id: "cultural", label: "文化控", emoji: "🏛️", desc: "博物館古蹟深度了解" },
  { id: "foodie", label: "美食獵人", emoji: "🍽️", desc: "跟著味蕾走遍天下" },
  { id: "relax", label: "放空型", emoji: "🏖️", desc: "躺平充電不排行程" },
  { id: "photo", label: "拍照狂", emoji: "📸", desc: "每個角落都是作品" },
  { id: "local", label: "在地控", emoji: "🗺️", desc: "融入當地感受生活" },
];

const CARD_COLORS = [
  "border-l-cyan-400 bg-cyan-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-sky-400 bg-sky-50",
  "border-l-indigo-400 bg-indigo-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TravelStyle({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<TravelStyleState>({
    gameId,
    sessionId,
    pageId,
    type: "travel_style",
    defaultState: { entries: [], revealed: false },
  });

  const [style, setStyle] = useState("");
  const [dream, setDream] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="ts-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as TravelEntry[]).find((e) => e.userId === userId);
  const canSubmit = style !== "" && dream.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: TravelEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      style,
      dream: dream.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as TravelEntry[]), entry] });
    setStyle("");
    setDream("");
  };

  const entries = state.entries as TravelEntry[];
  const revealed = state.revealed as boolean;

  const styleCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.style] = (acc[e.style] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="ts-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我的旅行風格"}
      </div>
      <div data-testid="ts-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "你是哪種旅行者？說說你的夢想旅行地！"}
      </div>
      <div data-testid="ts-count" className="text-xs text-center text-muted-foreground">
        已分享 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="ts-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                data-testid={`ts-style-${s.id}`}
                onClick={() => setStyle(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${style === s.id ? "border-cyan-400 bg-cyan-50 font-semibold" : "hover:border-cyan-300"}`}
              >
                <span className="text-xl shrink-0">{s.emoji}</span>
                <div className="text-left">
                  <div className="font-medium">{s.label}</div>
                  <div className="text-muted-foreground text-[10px]">{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ts-dream-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="你的夢想旅行目的地或故事？（至少5字）"
            value={dream}
            onChange={(e) => setDream(e.target.value)}
          />
          <button
            data-testid="ts-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-cyan-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            出發！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="ts-my-entry" className="bg-cyan-50 rounded-xl p-3 border border-cyan-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{STYLES.find((s) => s.id === myEntry.style)?.emoji}</span>
            <span className="text-sm font-semibold">{STYLES.find((s) => s.id === myEntry.style)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.dream}</div>
          <div className="text-xs text-muted-foreground mt-1">已分享</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="ts-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-cyan-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊旅行地圖
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="ts-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人分享旅行風格
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="ts-result" className="flex flex-col gap-3">
          <div data-testid="ts-style-summary" className="flex flex-wrap gap-2">
            {STYLES.filter((s) => styleCounts[s.id] > 0).map((s) => (
              <div
                key={s.id}
                data-testid={`ts-badge-${s.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-xs font-semibold"
              >
                {s.emoji} {s.label}
                <span className="ml-1 bg-cyan-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {styleCounts[s.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="ts-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const s = STYLES.find((x) => x.id === e.style);
              return (
                <div
                  key={e.entryId}
                  data-testid={`ts-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{s?.emoji}</span>
                    <span className="text-sm font-semibold">{s?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.dream}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
