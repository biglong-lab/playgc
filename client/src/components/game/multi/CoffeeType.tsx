import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface CoffeeEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  coffee: string;
  reason: string;
}

interface CoffeeTypeState extends Record<string, unknown> {
  entries: CoffeeEntry[];
  revealed: boolean;
}

interface CoffeeTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): CoffeeTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const COFFEES = [
  { id: "espresso", label: "濃縮咖啡", emoji: "☕", desc: "專注純粹直接了當" },
  { id: "americano", label: "美式咖啡", emoji: "🖤", desc: "低調務實不拖泥帶水" },
  { id: "latte", label: "拿鐵", emoji: "🥛", desc: "溫和包容易於相處" },
  { id: "cappuccino", label: "卡布奇諾", emoji: "🫧", desc: "平衡細膩注重層次" },
  { id: "macchiato", label: "瑪奇朵", emoji: "🌟", desc: "精緻有個性不從眾" },
  { id: "cold_brew", label: "冷萃咖啡", emoji: "🧊", desc: "沉穩耐得住時間磨練" },
  { id: "pour_over", label: "手沖咖啡", emoji: "🫗", desc: "講究過程享受細節" },
  { id: "mocha", label: "摩卡", emoji: "🍫", desc: "多元融合兼容並蓄" },
  { id: "flat_white", label: "馥列白", emoji: "⚪", desc: "簡約精準有品味" },
];

const CARD_COLORS = [
  "border-l-amber-700 bg-amber-50",
  "border-l-stone-600 bg-stone-50",
  "border-l-yellow-700 bg-yellow-50",
  "border-l-orange-700 bg-orange-50",
  "border-l-brown-600 bg-orange-100",
  "border-l-amber-500 bg-amber-50",
  "border-l-lime-700 bg-lime-50",
  "border-l-teal-600 bg-teal-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CoffeeType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<CoffeeTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "coffee_type",
    defaultState: { entries: [], revealed: false },
  });

  const [coffee, setCoffee] = useState("");
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
  const canSubmit = coffee !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: CoffeeEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      coffee,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as CoffeeEntry[]), entry] });
    setCoffee("");
    setReason("");
  };

  const entries = state.entries as CoffeeEntry[];
  const revealed = state.revealed as boolean;

  const coffeeCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.coffee] = (acc[e.coffee] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="cof-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種咖啡"}
      </div>
      <div data-testid="cof-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一杯咖啡，你最像哪種？說說你的咖啡個性！"}
      </div>
      <div data-testid="cof-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="cof-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {COFFEES.map((c) => (
              <button
                key={c.id}
                data-testid={`cof-coffee-${c.id}`}
                onClick={() => setCoffee(c.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${coffee === c.id ? "border-amber-700 bg-amber-50 font-semibold" : "hover:border-amber-600"}`}
              >
                <span className="text-2xl">{c.emoji}</span>
                <div className="font-medium text-center">{c.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{c.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="cof-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種咖啡最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="cof-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-amber-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            沖煮！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="cof-my-entry" className="bg-amber-50 rounded-xl p-3 border border-amber-300">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{COFFEES.find((c) => c.id === myEntry.coffee)?.emoji}</span>
            <span className="text-sm font-semibold">{COFFEES.find((c) => c.id === myEntry.coffee)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已上桌</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="cof-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-700 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊咖啡館
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="cof-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇咖啡類型
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="cof-result" className="flex flex-col gap-3">
          <div data-testid="cof-coffee-summary" className="flex flex-wrap gap-2">
            {COFFEES.filter((c) => coffeeCounts[c.id] > 0).map((c) => (
              <div
                key={c.id}
                data-testid={`cof-badge-${c.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold"
              >
                {c.emoji} {c.label}
                <span className="ml-1 bg-amber-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {coffeeCounts[c.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="cof-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const c = COFFEES.find((x) => x.id === e.coffee);
              return (
                <div
                  key={e.entryId}
                  data-testid={`cof-card-${e.entryId}`}
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
