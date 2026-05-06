import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface FishEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  fish: string;
  reason: string;
}

interface FishTypeState extends Record<string, unknown> {
  entries: FishEntry[];
  revealed: boolean;
}

interface FishTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): FishTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const FISHES = [
  { id: "salmon", label: "鮭魚", emoji: "🐟", desc: "勇往直前逆流而上" },
  { id: "tuna", label: "鮪魚", emoji: "🐠", desc: "速度強勁充滿力量" },
  { id: "clownfish", label: "小丑魚", emoji: "🤿", desc: "活潑可愛保護家園" },
  { id: "shark", label: "鯊魚", emoji: "🦈", desc: "強勢果決永不停歇" },
  { id: "goldfish", label: "金魚", emoji: "🐡", desc: "優雅觀賞帶來好運" },
  { id: "koi", label: "錦鯉", emoji: "🎏", desc: "堅持向上吉祥如意" },
  { id: "angelfish", label: "神仙魚", emoji: "🐬", desc: "飄逸美麗氣質出眾" },
  { id: "pufferfish", label: "河豚", emoji: "🐡", desc: "溫和圓潤有自我保護" },
  { id: "swordfish", label: "旗魚", emoji: "⚡", desc: "快速精準目標明確" },
];

const CARD_COLORS = [
  "border-l-blue-500 bg-blue-50",
  "border-l-indigo-500 bg-indigo-50",
  "border-l-cyan-500 bg-cyan-50",
  "border-l-sky-500 bg-sky-50",
  "border-l-blue-600 bg-blue-50",
  "border-l-indigo-600 bg-indigo-50",
  "border-l-cyan-600 bg-cyan-50",
  "border-l-sky-600 bg-sky-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function FishType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<FishTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "fish_type",
    defaultState: { entries: [], revealed: false },
  });

  const [fish, setFish] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="fsh-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as FishEntry[]).find((e) => e.userId === userId);
  const canSubmit = fish !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: FishEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      fish,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as FishEntry[]), entry] });
    setFish("");
    setReason("");
  };

  const entries = state.entries as FishEntry[];
  const revealed = state.revealed as boolean;

  const fishCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.fish] = (acc[e.fish] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="fsh-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種魚"}
      </div>
      <div data-testid="fsh-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種魚，你最像哪種？說說你的魚類個性！"}
      </div>
      <div data-testid="fsh-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="fsh-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {FISHES.map((f) => (
              <button
                key={f.id}
                data-testid={`fsh-fish-${f.id}`}
                onClick={() => setFish(f.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${fish === f.id ? "border-blue-500 bg-blue-50 font-semibold" : "hover:border-blue-400"}`}
              >
                <span className="text-2xl">{f.emoji}</span>
                <div className="font-medium text-center">{f.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{f.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="fsh-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種魚最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="fsh-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            入水！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="fsh-my-entry" className="bg-blue-50 rounded-xl p-3 border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{FISHES.find((f) => f.id === myEntry.fish)?.emoji}</span>
            <span className="text-sm font-semibold">{FISHES.find((f) => f.id === myEntry.fish)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已游入</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="fsh-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-blue-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊水族館
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="fsh-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇魚類
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="fsh-result" className="flex flex-col gap-3">
          <div data-testid="fsh-fish-summary" className="flex flex-wrap gap-2">
            {FISHES.filter((f) => fishCounts[f.id] > 0).map((f) => (
              <div
                key={f.id}
                data-testid={`fsh-badge-${f.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold"
              >
                {f.emoji} {f.label}
                <span className="ml-1 bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {fishCounts[f.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="fsh-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const f = FISHES.find((x) => x.id === e.fish);
              return (
                <div
                  key={e.entryId}
                  data-testid={`fsh-card-${e.entryId}`}
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
