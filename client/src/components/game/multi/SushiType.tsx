import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SushiEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  sushi: string;
  reason: string;
}

interface SushiTypeState extends Record<string, unknown> {
  entries: SushiEntry[];
  revealed: boolean;
}

interface SushiTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): SushiTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const SUSHIS = [
  { id: "salmon_nigiri", label: "鮭魚握壽司", emoji: "🍣", desc: "親切熟悉人人喜愛" },
  { id: "tuna_nigiri", label: "鮪魚握壽司", emoji: "❤️", desc: "熱情濃郁備受追捧" },
  { id: "california_roll", label: "加州卷", emoji: "🌀", desc: "創意融合開放包容" },
  { id: "dragon_roll", label: "龍卷", emoji: "🐉", desc: "華麗精緻令人驚豔" },
  { id: "temaki", label: "手卷", emoji: "🌮", desc: "隨性自由手工溫暖" },
  { id: "sashimi", label: "生魚片", emoji: "🔪", desc: "純粹直接本質展現" },
  { id: "gunkan", label: "軍艦卷", emoji: "🛳️", desc: "飽滿圓潤獨特存在" },
  { id: "chirashi", label: "散壽司", emoji: "🌸", desc: "豐盛多樣共同協作" },
  { id: "inari", label: "稻荷壽司", emoji: "🍥", desc: "甜蜜溫柔包容一切" },
];

const CARD_COLORS = [
  "border-l-red-500 bg-red-50",
  "border-l-orange-500 bg-orange-50",
  "border-l-pink-500 bg-pink-50",
  "border-l-rose-500 bg-rose-50",
  "border-l-red-400 bg-red-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-pink-400 bg-pink-50",
  "border-l-rose-400 bg-rose-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SushiType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SushiTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "sushi_type",
    defaultState: { entries: [], revealed: false },
  });

  const [sushi, setSushi] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="ssh-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as SushiEntry[]).find((e) => e.userId === userId);
  const canSubmit = sushi !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: SushiEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      sushi,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as SushiEntry[]), entry] });
    setSushi("");
    setReason("");
  };

  const entries = state.entries as SushiEntry[];
  const revealed = state.revealed as boolean;

  const sushiCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.sushi] = (acc[e.sushi] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="ssh-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種壽司"}
      </div>
      <div data-testid="ssh-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種壽司，你最像哪種？說說你的壽司個性！"}
      </div>
      <div data-testid="ssh-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="ssh-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {SUSHIS.map((s) => (
              <button
                key={s.id}
                data-testid={`ssh-sushi-${s.id}`}
                onClick={() => setSushi(s.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${sushi === s.id ? "border-red-500 bg-red-50 font-semibold" : "hover:border-red-400"}`}
              >
                <span className="text-2xl">{s.emoji}</span>
                <div className="font-medium text-center">{s.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{s.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ssh-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種壽司最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="ssh-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-red-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            握壽司！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="ssh-my-entry" className="bg-red-50 rounded-xl p-3 border border-red-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{SUSHIS.find((s) => s.id === myEntry.sushi)?.emoji}</span>
            <span className="text-sm font-semibold">{SUSHIS.find((s) => s.id === myEntry.sushi)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已上市</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="ssh-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-red-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊壽司台
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="ssh-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇壽司
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="ssh-result" className="flex flex-col gap-3">
          <div data-testid="ssh-sushi-summary" className="flex flex-wrap gap-2">
            {SUSHIS.filter((s) => sushiCounts[s.id] > 0).map((s) => (
              <div
                key={s.id}
                data-testid={`ssh-badge-${s.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold"
              >
                {s.emoji} {s.label}
                <span className="ml-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {sushiCounts[s.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="ssh-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const s = SUSHIS.find((x) => x.id === e.sushi);
              return (
                <div
                  key={e.entryId}
                  data-testid={`ssh-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{s?.emoji}</span>
                    <span className="text-sm font-semibold">{s?.label}</span>
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
