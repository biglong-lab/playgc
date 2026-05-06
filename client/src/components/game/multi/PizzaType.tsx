import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface PizzaEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  pizza: string;
  reason: string;
}

interface PizzaTypeState extends Record<string, unknown> {
  entries: PizzaEntry[];
  revealed: boolean;
}

interface PizzaTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): PizzaTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const PIZZAS = [
  { id: "margherita", label: "瑪格麗特", emoji: "🍕", desc: "經典純粹回歸本質" },
  { id: "pepperoni", label: "辣香腸", emoji: "🌶️", desc: "熱辣強烈個性鮮明" },
  { id: "bbq_chicken", label: "BBQ雞肉", emoji: "🍗", desc: "煙燻香甜讓人著迷" },
  { id: "veggie", label: "蔬食", emoji: "🥦", desc: "清新多元健康均衡" },
  { id: "hawaii", label: "夏威夷", emoji: "🍍", desc: "甜鹹衝突出人意料" },
  { id: "truffle", label: "松露", emoji: "🖤", desc: "奢華細膩不凡品味" },
  { id: "seafood", label: "海鮮", emoji: "🦐", desc: "鮮美豐盛層次豐富" },
  { id: "four_cheese", label: "四種起司", emoji: "🧀", desc: "濃郁複雜越陷越深" },
  { id: "calzone", label: "卡爾佐內", emoji: "🫓", desc: "外表低調內有乾坤" },
];

const CARD_COLORS = [
  "border-l-orange-500 bg-orange-50",
  "border-l-red-500 bg-red-50",
  "border-l-amber-500 bg-amber-50",
  "border-l-yellow-500 bg-yellow-50",
  "border-l-orange-600 bg-orange-50",
  "border-l-red-600 bg-red-50",
  "border-l-amber-600 bg-amber-50",
  "border-l-yellow-600 bg-yellow-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PizzaType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<PizzaTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "pizza_type",
    defaultState: { entries: [], revealed: false },
  });

  const [pizza, setPizza] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="pza-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as PizzaEntry[]).find((e) => e.userId === userId);
  const canSubmit = pizza !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: PizzaEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      pizza,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as PizzaEntry[]), entry] });
    setPizza("");
    setReason("");
  };

  const entries = state.entries as PizzaEntry[];
  const revealed = state.revealed as boolean;

  const pizzaCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.pizza] = (acc[e.pizza] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="pza-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種披薩"}
      </div>
      <div data-testid="pza-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種披薩，你最像哪種？說說你的披薩個性！"}
      </div>
      <div data-testid="pza-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="pza-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {PIZZAS.map((p) => (
              <button
                key={p.id}
                data-testid={`pza-pizza-${p.id}`}
                onClick={() => setPizza(p.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${pizza === p.id ? "border-orange-500 bg-orange-50 font-semibold" : "hover:border-orange-400"}`}
              >
                <span className="text-2xl">{p.emoji}</span>
                <div className="font-medium text-center">{p.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{p.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="pza-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種披薩最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="pza-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-orange-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            出爐！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="pza-my-entry" className="bg-orange-50 rounded-xl p-3 border border-orange-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{PIZZAS.find((p) => p.id === myEntry.pizza)?.emoji}</span>
            <span className="text-sm font-semibold">{PIZZAS.find((p) => p.id === myEntry.pizza)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已切片</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="pza-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-orange-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊披薩窯
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="pza-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇披薩
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="pza-result" className="flex flex-col gap-3">
          <div data-testid="pza-pizza-summary" className="flex flex-wrap gap-2">
            {PIZZAS.filter((p) => pizzaCounts[p.id] > 0).map((p) => (
              <div
                key={p.id}
                data-testid={`pza-badge-${p.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold"
              >
                {p.emoji} {p.label}
                <span className="ml-1 bg-orange-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {pizzaCounts[p.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="pza-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const p = PIZZAS.find((x) => x.id === e.pizza);
              return (
                <div
                  key={e.entryId}
                  data-testid={`pza-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{p?.emoji}</span>
                    <span className="text-sm font-semibold">{p?.label}</span>
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
