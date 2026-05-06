import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface FruitEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  fruit: string;
  reason: string;
}

interface FruitTypeState extends Record<string, unknown> {
  entries: FruitEntry[];
  revealed: boolean;
}

interface FruitTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): FruitTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const FRUITS = [
  { id: "apple", label: "蘋果", emoji: "🍎", desc: "親切熟悉百搭萬用" },
  { id: "mango", label: "芒果", emoji: "🥭", desc: "熱情甜蜜充滿魅力" },
  { id: "strawberry", label: "草莓", emoji: "🍓", desc: "嬌豔可愛令人喜愛" },
  { id: "watermelon", label: "西瓜", emoji: "🍉", desc: "豪爽大方活力十足" },
  { id: "grape", label: "葡萄", emoji: "🍇", desc: "細膩豐富層次感強" },
  { id: "lemon", label: "檸檬", emoji: "🍋", desc: "清新犀利一點就夠" },
  { id: "pineapple", label: "鳳梨", emoji: "🍍", desc: "外硬內甜出乎意料" },
  { id: "peach", label: "水蜜桃", emoji: "🍑", desc: "溫柔甜美圓潤飽滿" },
  { id: "blueberry", label: "藍莓", emoji: "🫐", desc: "低調小巧能量滿滿" },
];

const CARD_COLORS = [
  "border-l-green-500 bg-green-50",
  "border-l-emerald-500 bg-emerald-50",
  "border-l-lime-500 bg-lime-50",
  "border-l-teal-500 bg-teal-50",
  "border-l-green-600 bg-green-50",
  "border-l-emerald-600 bg-emerald-50",
  "border-l-lime-600 bg-lime-50",
  "border-l-teal-600 bg-teal-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function FruitType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<FruitTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "fruit_type",
    defaultState: { entries: [], revealed: false },
  });

  const [fruit, setFruit] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="frt-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as FruitEntry[]).find((e) => e.userId === userId);
  const canSubmit = fruit !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: FruitEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      fruit,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as FruitEntry[]), entry] });
    setFruit("");
    setReason("");
  };

  const entries = state.entries as FruitEntry[];
  const revealed = state.revealed as boolean;

  const fruitCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.fruit] = (acc[e.fruit] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="frt-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種水果"}
      </div>
      <div data-testid="frt-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種水果，你最像哪種？說說你的水果個性！"}
      </div>
      <div data-testid="frt-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="frt-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {FRUITS.map((f) => (
              <button
                key={f.id}
                data-testid={`frt-fruit-${f.id}`}
                onClick={() => setFruit(f.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${fruit === f.id ? "border-green-500 bg-green-50 font-semibold" : "hover:border-green-400"}`}
              >
                <span className="text-2xl">{f.emoji}</span>
                <div className="font-medium text-center">{f.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{f.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="frt-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種水果最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="frt-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-green-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            採果！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="frt-my-entry" className="bg-green-50 rounded-xl p-3 border border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{FRUITS.find((f) => f.id === myEntry.fruit)?.emoji}</span>
            <span className="text-sm font-semibold">{FRUITS.find((f) => f.id === myEntry.fruit)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已成熟</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="frt-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-green-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊果籃
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="frt-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇水果
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="frt-result" className="flex flex-col gap-3">
          <div data-testid="frt-fruit-summary" className="flex flex-wrap gap-2">
            {FRUITS.filter((f) => fruitCounts[f.id] > 0).map((f) => (
              <div
                key={f.id}
                data-testid={`frt-badge-${f.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold"
              >
                {f.emoji} {f.label}
                <span className="ml-1 bg-green-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {fruitCounts[f.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="frt-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const f = FRUITS.find((x) => x.id === e.fruit);
              return (
                <div
                  key={e.entryId}
                  data-testid={`frt-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
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
