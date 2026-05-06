import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface CoffeeEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  drink: string;
  reason: string;
}

interface CoffeeOrderState extends Record<string, unknown> {
  entries: CoffeeEntry[];
  revealed: boolean;
}

interface CoffeeOrderConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): CoffeeOrderConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const DRINKS = [
  { id: "americano", label: "美式咖啡", emoji: "☕", desc: "直接純粹不拐彎抹角" },
  { id: "latte", label: "拿鐵", emoji: "🥛", desc: "溫和順口兼顧各方" },
  { id: "cappuccino", label: "卡布奇諾", emoji: "☁️", desc: "細膩層次有點小講究" },
  { id: "espresso", label: "濃縮咖啡", emoji: "🎯", desc: "精準高效爆發力強" },
  { id: "matcha", label: "抹茶", emoji: "🍵", desc: "沉穩清雅自有風格" },
  { id: "boba", label: "珍珠奶茶", emoji: "🧋", desc: "多元混搭活潑有趣" },
  { id: "juice", label: "果汁", emoji: "🧃", desc: "清新活力自然健康" },
  { id: "water", label: "白開水", emoji: "💧", desc: "純粹自在不需裝飾" },
  { id: "hotchocolate", label: "熱可可", emoji: "🍫", desc: "溫暖療癒需要甜甜" },
];

const CARD_COLORS = [
  "border-l-brown-400 bg-amber-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-yellow-400 bg-yellow-50",
  "border-l-green-400 bg-green-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-indigo-400 bg-indigo-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CoffeeOrder({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<CoffeeOrderState>({
    gameId,
    sessionId,
    pageId,
    type: "coffee_order",
    defaultState: { entries: [], revealed: false },
  });

  const [drink, setDrink] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="cof-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as CoffeeEntry[]).find((e) => e.userId === userId);
  const canSubmit = drink !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: CoffeeEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      drink,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as CoffeeEntry[]), entry] });
    setDrink("");
    setReason("");
  };

  const entries = state.entries as CoffeeEntry[];
  const revealed = state.revealed as boolean;

  const drinkCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.drink] = (acc[e.drink] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="cof-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我今天的飲料訂單"}
      </div>
      <div data-testid="cof-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你今天的狀態是一杯飲料，你會點哪一杯？說說你的感覺！"}
      </div>
      <div data-testid="cof-count" className="text-xs text-center text-muted-foreground">
        已點單 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="cof-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {DRINKS.map((d) => (
              <button
                key={d.id}
                data-testid={`cof-drink-${d.id}`}
                onClick={() => setDrink(d.id)}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs transition-all ${drink === d.id ? "border-amber-400 bg-amber-50 font-semibold" : "hover:border-amber-300"}`}
              >
                <span className="text-2xl">{d.emoji}</span>
                <div className="font-medium text-center">{d.label}</div>
                <div className="text-muted-foreground text-[9px] text-center leading-tight">{d.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="cof-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這杯最像你今天的狀態？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="cof-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-amber-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            點單！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="cof-my-entry" className="bg-amber-50 rounded-xl p-3 border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{DRINKS.find((d) => d.id === myEntry.drink)?.emoji}</span>
            <span className="text-sm font-semibold">{DRINKS.find((d) => d.id === myEntry.drink)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已點單</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="cof-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊飲料菜單
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="cof-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人點單
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="cof-result" className="flex flex-col gap-3">
          <div data-testid="cof-drink-summary" className="flex flex-wrap gap-2">
            {DRINKS.filter((d) => drinkCounts[d.id] > 0).map((d) => (
              <div
                key={d.id}
                data-testid={`cof-badge-${d.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold"
              >
                {d.emoji} {d.label}
                <span className="ml-1 bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {drinkCounts[d.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="cof-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const d = DRINKS.find((x) => x.id === e.drink);
              return (
                <div
                  key={e.entryId}
                  data-testid={`cof-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{d?.emoji}</span>
                    <span className="text-sm font-semibold">{d?.label}</span>
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
