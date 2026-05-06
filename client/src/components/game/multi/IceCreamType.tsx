import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface IceCreamEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  iceCream: string;
  reason: string;
}

interface IceCreamTypeState extends Record<string, unknown> {
  entries: IceCreamEntry[];
  revealed: boolean;
}

interface IceCreamTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): IceCreamTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const ICE_CREAMS = [
  { id: "vanilla", label: "香草", emoji: "🍦", desc: "經典百搭溫和迷人" },
  { id: "chocolate", label: "巧克力", emoji: "🍫", desc: "濃郁深沉讓人著迷" },
  { id: "strawberry", label: "草莓", emoji: "🍓", desc: "甜美粉嫩充滿活力" },
  { id: "matcha", label: "抹茶", emoji: "🍵", desc: "清雅獨特回甘無窮" },
  { id: "mint_choc", label: "薄荷巧克力", emoji: "🌿", desc: "清爽刺激出乎意料" },
  { id: "cookies_cream", label: "奧利奧", emoji: "🍪", desc: "層次豐富讓人驚喜" },
  { id: "mango", label: "芒果", emoji: "🥭", desc: "熱情奔放充滿南洋" },
  { id: "blueberry", label: "藍莓", emoji: "🫐", desc: "低調甜酸健康滿滿" },
  { id: "lemon_sorbet", label: "檸檬雪酪", emoji: "🍋", desc: "清新直接一口清醒" },
];

const CARD_COLORS = [
  "border-l-pink-400 bg-pink-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-fuchsia-400 bg-fuchsia-50",
  "border-l-purple-400 bg-purple-50",
  "border-l-pink-500 bg-pink-50",
  "border-l-rose-500 bg-rose-50",
  "border-l-fuchsia-500 bg-fuchsia-50",
  "border-l-purple-500 bg-purple-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function IceCreamType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<IceCreamTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "ice_cream_type",
    defaultState: { entries: [], revealed: false },
  });

  const [iceCream, setIceCream] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="ice-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as IceCreamEntry[]).find((e) => e.userId === userId);
  const canSubmit = iceCream !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: IceCreamEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      iceCream,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as IceCreamEntry[]), entry] });
    setIceCream("");
    setReason("");
  };

  const entries = state.entries as IceCreamEntry[];
  const revealed = state.revealed as boolean;

  const iceCreamCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.iceCream] = (acc[e.iceCream] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="ice-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種冰淇淋"}
      </div>
      <div data-testid="ice-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種冰淇淋，你最像哪種？說說你的冰淇淋個性！"}
      </div>
      <div data-testid="ice-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="ice-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {ICE_CREAMS.map((ic) => (
              <button
                key={ic.id}
                data-testid={`ice-icecream-${ic.id}`}
                onClick={() => setIceCream(ic.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${iceCream === ic.id ? "border-pink-500 bg-pink-50 font-semibold" : "hover:border-pink-400"}`}
              >
                <span className="text-2xl">{ic.emoji}</span>
                <div className="font-medium text-center">{ic.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{ic.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ice-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種冰淇淋最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="ice-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-pink-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            挖冰！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="ice-my-entry" className="bg-pink-50 rounded-xl p-3 border border-pink-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{ICE_CREAMS.find((ic) => ic.id === myEntry.iceCream)?.emoji}</span>
            <span className="text-sm font-semibold">{ICE_CREAMS.find((ic) => ic.id === myEntry.iceCream)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已融化</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="ice-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-pink-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊冰淇淋車
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="ice-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇冰淇淋
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="ice-result" className="flex flex-col gap-3">
          <div data-testid="ice-icecream-summary" className="flex flex-wrap gap-2">
            {ICE_CREAMS.filter((ic) => iceCreamCounts[ic.id] > 0).map((ic) => (
              <div
                key={ic.id}
                data-testid={`ice-badge-${ic.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-semibold"
              >
                {ic.emoji} {ic.label}
                <span className="ml-1 bg-pink-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {iceCreamCounts[ic.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="ice-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const ic = ICE_CREAMS.find((x) => x.id === e.iceCream);
              return (
                <div
                  key={e.entryId}
                  data-testid={`ice-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{ic?.emoji}</span>
                    <span className="text-sm font-semibold">{ic?.label}</span>
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
