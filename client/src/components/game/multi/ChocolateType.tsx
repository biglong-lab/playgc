import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ChocolateEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  chocolate: string;
  reason: string;
}

interface ChocolateTypeState extends Record<string, unknown> {
  entries: ChocolateEntry[];
  revealed: boolean;
}

interface ChocolateTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): ChocolateTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const CHOCOLATES = [
  { id: "dark", label: "黑巧克力", emoji: "🍫", desc: "深沉苦中帶甘回韻悠長" },
  { id: "milk", label: "牛奶巧克力", emoji: "🍬", desc: "溫和甜蜜老少皆宜" },
  { id: "white", label: "白巧克力", emoji: "🤍", desc: "純粹柔和溫暖包容" },
  { id: "matcha", label: "抹茶巧克力", emoji: "🍵", desc: "清新獨特東方風情" },
  { id: "caramel", label: "焦糖巧克力", emoji: "✨", desc: "甜蜜複雜越品越香" },
  { id: "raspberry", label: "覆盆子巧克力", emoji: "🫐", desc: "酸甜衝突個性鮮明" },
  { id: "orange", label: "柑橘巧克力", emoji: "🍊", desc: "清爽活潑帶來驚喜" },
  { id: "hazelnut", label: "榛果巧克力", emoji: "🌰", desc: "紮實濃郁口感豐富" },
  { id: "truffle", label: "松露巧克力", emoji: "🖤", desc: "奢華精緻難以忘懷" },
];

const CARD_COLORS = [
  "border-l-amber-800 bg-amber-50",
  "border-l-amber-700 bg-amber-50",
  "border-l-yellow-700 bg-yellow-50",
  "border-l-orange-700 bg-orange-50",
  "border-l-amber-900 bg-amber-50",
  "border-l-orange-800 bg-orange-50",
  "border-l-yellow-800 bg-yellow-50",
  "border-l-stone-700 bg-stone-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ChocolateType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ChocolateTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "chocolate_type",
    defaultState: { entries: [], revealed: false },
  });

  const [chocolate, setChocolate] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="chc-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as ChocolateEntry[]).find((e) => e.userId === userId);
  const canSubmit = chocolate !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: ChocolateEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      chocolate,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as ChocolateEntry[]), entry] });
    setChocolate("");
    setReason("");
  };

  const entries = state.entries as ChocolateEntry[];
  const revealed = state.revealed as boolean;

  const chocolateCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.chocolate] = (acc[e.chocolate] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="chc-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種巧克力"}
      </div>
      <div data-testid="chc-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種巧克力，你最像哪種？說說你的巧克力個性！"}
      </div>
      <div data-testid="chc-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="chc-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {CHOCOLATES.map((c) => (
              <button
                key={c.id}
                data-testid={`chc-chocolate-${c.id}`}
                onClick={() => setChocolate(c.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${chocolate === c.id ? "border-amber-700 bg-amber-50 font-semibold" : "hover:border-amber-600"}`}
              >
                <span className="text-2xl">{c.emoji}</span>
                <div className="font-medium text-center">{c.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{c.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="chc-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種巧克力最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="chc-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-amber-800 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            入口即化！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="chc-my-entry" className="bg-amber-50 rounded-xl p-3 border border-amber-300">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{CHOCOLATES.find((c) => c.id === myEntry.chocolate)?.emoji}</span>
            <span className="text-sm font-semibold">{CHOCOLATES.find((c) => c.id === myEntry.chocolate)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已包裝</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="chc-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-800 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊巧克力盒
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="chc-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇巧克力
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="chc-result" className="flex flex-col gap-3">
          <div data-testid="chc-chocolate-summary" className="flex flex-wrap gap-2">
            {CHOCOLATES.filter((c) => chocolateCounts[c.id] > 0).map((c) => (
              <div
                key={c.id}
                data-testid={`chc-badge-${c.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold"
              >
                {c.emoji} {c.label}
                <span className="ml-1 bg-amber-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {chocolateCounts[c.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="chc-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const c = CHOCOLATES.find((x) => x.id === e.chocolate);
              return (
                <div
                  key={e.entryId}
                  data-testid={`chc-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
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
