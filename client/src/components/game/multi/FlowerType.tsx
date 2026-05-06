import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface FlowerEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  flower: string;
  reason: string;
}

interface FlowerTypeState extends Record<string, unknown> {
  entries: FlowerEntry[];
  revealed: boolean;
}

interface FlowerTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): FlowerTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const FLOWERS = [
  { id: "rose", label: "玫瑰", emoji: "🌹", desc: "熱情奔放愛恨分明" },
  { id: "lily", label: "百合", emoji: "🌸", desc: "優雅高貴純潔無私" },
  { id: "tulip", label: "鬱金香", emoji: "🌷", desc: "精緻完美注重品味" },
  { id: "daisy", label: "雛菊", emoji: "🌼", desc: "自然純樸親切可愛" },
  { id: "lavender", label: "薰衣草", emoji: "💜", desc: "療癒安靜讓人放鬆" },
  { id: "peony", label: "牡丹", emoji: "🌺", desc: "富貴大方氣場強大" },
  { id: "hydrangea", label: "繡球花", emoji: "💙", desc: "豐盛多元融合共存" },
  { id: "iris", label: "鳶尾花", emoji: "🔵", desc: "神秘獨特充滿個性" },
  { id: "chrysanthemum", label: "菊花", emoji: "🌻", desc: "堅毅長久不輕言放棄" },
];

const CARD_COLORS = [
  "border-l-rose-400 bg-rose-50",
  "border-l-pink-400 bg-pink-50",
  "border-l-fuchsia-400 bg-fuchsia-50",
  "border-l-purple-400 bg-purple-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-indigo-400 bg-indigo-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-teal-400 bg-teal-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function FlowerType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<FlowerTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "flower_type",
    defaultState: { entries: [], revealed: false },
  });

  const [flower, setFlower] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="flo-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as FlowerEntry[]).find((e) => e.userId === userId);
  const canSubmit = flower !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: FlowerEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      flower,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as FlowerEntry[]), entry] });
    setFlower("");
    setReason("");
  };

  const entries = state.entries as FlowerEntry[];
  const revealed = state.revealed as boolean;

  const flowerCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.flower] = (acc[e.flower] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="flo-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種花"}
      </div>
      <div data-testid="flo-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一朵花，你最像哪種？說說你的花語個性！"}
      </div>
      <div data-testid="flo-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="flo-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {FLOWERS.map((f) => (
              <button
                key={f.id}
                data-testid={`flo-flower-${f.id}`}
                onClick={() => setFlower(f.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${flower === f.id ? "border-rose-500 bg-rose-50 font-semibold" : "hover:border-rose-400"}`}
              >
                <span className="text-2xl">{f.emoji}</span>
                <div className="font-medium text-center">{f.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{f.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="flo-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種花最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="flo-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-rose-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            盛開！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="flo-my-entry" className="bg-rose-50 rounded-xl p-3 border border-rose-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{FLOWERS.find((f) => f.id === myEntry.flower)?.emoji}</span>
            <span className="text-sm font-semibold">{FLOWERS.find((f) => f.id === myEntry.flower)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已綻放</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="flo-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-rose-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊花園
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="flo-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇花朵類型
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="flo-result" className="flex flex-col gap-3">
          <div data-testid="flo-flower-summary" className="flex flex-wrap gap-2">
            {FLOWERS.filter((f) => flowerCounts[f.id] > 0).map((f) => (
              <div
                key={f.id}
                data-testid={`flo-badge-${f.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold"
              >
                {f.emoji} {f.label}
                <span className="ml-1 bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {flowerCounts[f.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="flo-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const f = FLOWERS.find((x) => x.id === e.flower);
              return (
                <div
                  key={e.entryId}
                  data-testid={`flo-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
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
