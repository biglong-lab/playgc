import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface FoodEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  food: string;
  reason: string;
}

interface FoodMoodState extends Record<string, unknown> {
  entries: FoodEntry[];
  revealed: boolean;
}

interface FoodMoodConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): FoodMoodConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const FOODS = [
  { id: "ramen", label: "熱湯麵", emoji: "🍜", desc: "溫暖療癒需要人陪" },
  { id: "pizza", label: "披薩", emoji: "🍕", desc: "熱鬧多元大家分享" },
  { id: "salad", label: "沙拉", emoji: "🥗", desc: "清爽輕盈健康自律" },
  { id: "cake", label: "蛋糕", emoji: "🎂", desc: "甜蜜幸福值得慶祝" },
  { id: "coffee", label: "咖啡", emoji: "☕", desc: "清醒專注需要提神" },
  { id: "bento", label: "便當", emoji: "🍱", desc: "踏實豐盛一切就緒" },
  { id: "icecream", label: "冰淇淋", emoji: "🍦", desc: "放鬆享樂小小獎勵" },
  { id: "hotpot", label: "火鍋", emoji: "🫕", desc: "熱情沸騰人越多越好" },
  { id: "bread", label: "麵包", emoji: "🥐", desc: "平穩可靠每天必備" },
  { id: "spicy", label: "麻辣", emoji: "🌶️", desc: "刺激過癮充滿衝勁" },
];

const CARD_COLORS = [
  "border-l-orange-400 bg-orange-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-yellow-400 bg-yellow-50",
  "border-l-green-400 bg-green-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-pink-400 bg-pink-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function FoodMood({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<FoodMoodState>({
    gameId,
    sessionId,
    pageId,
    type: "food_mood",
    defaultState: { entries: [], revealed: false },
  });

  const [food, setFood] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="fm-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as FoodEntry[]).find((e) => e.userId === userId);
  const canSubmit = food !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: FoodEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      food,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as FoodEntry[]), entry] });
    setFood("");
    setReason("");
  };

  const entries = state.entries as FoodEntry[];
  const revealed = state.revealed as boolean;

  const foodCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.food] = (acc[e.food] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="fm-title" className="text-xl font-bold text-center">
        {cfg.title ?? "今天我是哪道料理"}
      </div>
      <div data-testid="fm-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果今天的你是一道料理，你會是哪種？說說原因！"}
      </div>
      <div data-testid="fm-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="fm-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-2">
            {FOODS.map((f) => (
              <button
                key={f.id}
                data-testid={`fm-food-${f.id}`}
                onClick={() => setFood(f.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${food === f.id ? "border-orange-400 bg-orange-50 font-semibold" : "hover:border-orange-300"}`}
              >
                <span className="text-xl shrink-0">{f.emoji}</span>
                <div className="text-left">
                  <div className="font-medium">{f.label}</div>
                  <div className="text-muted-foreground text-[10px]">{f.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="fm-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼今天你是這道料理？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="fm-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-orange-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            上菜！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="fm-my-entry" className="bg-orange-50 rounded-xl p-3 border border-orange-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{FOODS.find((f) => f.id === myEntry.food)?.emoji}</span>
            <span className="text-sm font-semibold">{FOODS.find((f) => f.id === myEntry.food)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已上菜</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="fm-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-orange-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          開席！揭曉全隊料理台
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="fm-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇料理
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="fm-result" className="flex flex-col gap-3">
          <div data-testid="fm-food-summary" className="flex flex-wrap gap-2">
            {FOODS.filter((f) => foodCounts[f.id] > 0).map((f) => (
              <div
                key={f.id}
                data-testid={`fm-badge-${f.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold"
              >
                {f.emoji} {f.label}
                <span className="ml-1 bg-orange-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {foodCounts[f.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="fm-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const f = FOODS.find((x) => x.id === e.food);
              return (
                <div
                  key={e.entryId}
                  data-testid={`fm-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{f?.emoji}</span>
                    <span className="text-sm font-semibold">{f?.label}</span>
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
