import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface CandyEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  candy: string;
  reason: string;
}

interface CandyTypeState extends Record<string, unknown> {
  entries: CandyEntry[];
  revealed: boolean;
}

interface CandyTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): CandyTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const CANDIES = [
  { id: "chocolate", label: "巧克力", emoji: "🍫", desc: "深邃濃郁回味無窮" },
  { id: "gummy", label: "軟糖", emoji: "🐻", desc: "彈性十足韌而不斷" },
  { id: "lollipop", label: "棒棒糖", emoji: "🍭", desc: "活潑多彩帶來歡樂" },
  { id: "hard_candy", label: "硬糖", emoji: "🍬", desc: "持久耐得住慢慢品味" },
  { id: "marshmallow", label: "棉花糖", emoji: "🌥️", desc: "柔軟療癒讓人放鬆" },
  { id: "caramel", label: "焦糖", emoji: "🍯", desc: "甜中帶苦層次豐富" },
  { id: "sour", label: "酸糖", emoji: "😝", desc: "刺激獨特讓人難忘" },
  { id: "mint", label: "薄荷糖", emoji: "🌿", desc: "清新提神讓人清醒" },
  { id: "cotton_candy", label: "棉花糖（雲朵）", emoji: "🎡", desc: "夢幻輕盈充滿想像" },
];

const CARD_COLORS = [
  "border-l-pink-500 bg-pink-50",
  "border-l-purple-400 bg-purple-50",
  "border-l-red-400 bg-red-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-yellow-400 bg-yellow-50",
  "border-l-lime-400 bg-lime-50",
  "border-l-fuchsia-400 bg-fuchsia-50",
  "border-l-rose-400 bg-rose-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CandyType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<CandyTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "candy_type",
    defaultState: { entries: [], revealed: false },
  });

  const [candy, setCandy] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="cdy-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as CandyEntry[]).find((e) => e.userId === userId);
  const canSubmit = candy !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: CandyEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      candy,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as CandyEntry[]), entry] });
    setCandy("");
    setReason("");
  };

  const entries = state.entries as CandyEntry[];
  const revealed = state.revealed as boolean;

  const candyCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.candy] = (acc[e.candy] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="cdy-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種糖果"}
      </div>
      <div data-testid="cdy-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種糖果，你最像哪種？說說你的甜蜜個性！"}
      </div>
      <div data-testid="cdy-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="cdy-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {CANDIES.map((c) => (
              <button
                key={c.id}
                data-testid={`cdy-candy-${c.id}`}
                onClick={() => setCandy(c.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${candy === c.id ? "border-pink-500 bg-pink-50 font-semibold" : "hover:border-pink-400"}`}
              >
                <span className="text-2xl">{c.emoji}</span>
                <div className="font-medium text-center">{c.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{c.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="cdy-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種糖果最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="cdy-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-pink-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            嚐一口！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="cdy-my-entry" className="bg-pink-50 rounded-xl p-3 border border-pink-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{CANDIES.find((c) => c.id === myEntry.candy)?.emoji}</span>
            <span className="text-sm font-semibold">{CANDIES.find((c) => c.id === myEntry.candy)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已入口</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="cdy-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-pink-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊糖果罐
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="cdy-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇糖果類型
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="cdy-result" className="flex flex-col gap-3">
          <div data-testid="cdy-candy-summary" className="flex flex-wrap gap-2">
            {CANDIES.filter((c) => candyCounts[c.id] > 0).map((c) => (
              <div
                key={c.id}
                data-testid={`cdy-badge-${c.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-xs font-semibold"
              >
                {c.emoji} {c.label}
                <span className="ml-1 bg-pink-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {candyCounts[c.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="cdy-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const c = CANDIES.find((x) => x.id === e.candy);
              return (
                <div
                  key={e.entryId}
                  data-testid={`cdy-card-${e.entryId}`}
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
