import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface CheeseEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  cheese: string;
  reason: string;
}

interface CheeseTypeState extends Record<string, unknown> {
  entries: CheeseEntry[];
  revealed: boolean;
}

interface CheeseTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): CheeseTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const CHEESES = [
  { id: "cheddar", label: "切達", emoji: "🧀", desc: "經典濃郁老實可靠" },
  { id: "brie", label: "布利", emoji: "🌸", desc: "外柔內軟優雅迷人" },
  { id: "gouda", label: "高達", emoji: "🟡", desc: "溫潤甘甜圓融和諧" },
  { id: "parmesan", label: "帕瑪森", emoji: "⭐", desc: "越陳越香深厚底蘊" },
  { id: "mozzarella", label: "莫扎瑞拉", emoji: "🤍", desc: "清新純淨彈性十足" },
  { id: "camembert", label: "卡門貝爾", emoji: "🍄", desc: "外表平靜內心豐富" },
  { id: "feta", label: "菲達", emoji: "🌿", desc: "清爽直率鮮明個性" },
  { id: "ricotta", label: "瑞可塔", emoji: "☁️", desc: "輕盈溫柔包容萬物" },
  { id: "swiss", label: "瑞士起司", emoji: "🕳️", desc: "孔洞獨特別具風味" },
];

const CARD_COLORS = [
  "border-l-yellow-500 bg-yellow-50",
  "border-l-amber-500 bg-amber-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-yellow-400 bg-yellow-50",
  "border-l-cream-400 bg-stone-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-lime-400 bg-lime-50",
  "border-l-yellow-600 bg-yellow-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CheeseType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<CheeseTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "cheese_type",
    defaultState: { entries: [], revealed: false },
  });

  const [cheese, setCheese] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="che-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as CheeseEntry[]).find((e) => e.userId === userId);
  const canSubmit = cheese !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: CheeseEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      cheese,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as CheeseEntry[]), entry] });
    setCheese("");
    setReason("");
  };

  const entries = state.entries as CheeseEntry[];
  const revealed = state.revealed as boolean;

  const cheeseCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.cheese] = (acc[e.cheese] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="che-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種起司"}
      </div>
      <div data-testid="che-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種起司，你最像哪種？說說你的起司個性！"}
      </div>
      <div data-testid="che-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="che-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {CHEESES.map((c) => (
              <button
                key={c.id}
                data-testid={`che-cheese-${c.id}`}
                onClick={() => setCheese(c.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${cheese === c.id ? "border-yellow-500 bg-yellow-50 font-semibold" : "hover:border-yellow-400"}`}
              >
                <span className="text-2xl">{c.emoji}</span>
                <div className="font-medium text-center">{c.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{c.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="che-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種起司最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="che-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-yellow-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            熟成！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="che-my-entry" className="bg-yellow-50 rounded-xl p-3 border border-yellow-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{CHEESES.find((c) => c.id === myEntry.cheese)?.emoji}</span>
            <span className="text-sm font-semibold">{CHEESES.find((c) => c.id === myEntry.cheese)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已陳放</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="che-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-yellow-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊起司盤
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="che-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇起司
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="che-result" className="flex flex-col gap-3">
          <div data-testid="che-cheese-summary" className="flex flex-wrap gap-2">
            {CHEESES.filter((c) => cheeseCounts[c.id] > 0).map((c) => (
              <div
                key={c.id}
                data-testid={`che-badge-${c.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold"
              >
                {c.emoji} {c.label}
                <span className="ml-1 bg-yellow-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {cheeseCounts[c.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="che-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const c = CHEESES.find((x) => x.id === e.cheese);
              return (
                <div
                  key={e.entryId}
                  data-testid={`che-card-${e.entryId}`}
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
