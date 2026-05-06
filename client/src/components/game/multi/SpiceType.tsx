import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SpiceEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  spice: string;
  reason: string;
}

interface SpiceTypeState extends Record<string, unknown> {
  entries: SpiceEntry[];
  revealed: boolean;
}

interface SpiceTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): SpiceTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const SPICES = [
  { id: "chili", label: "辣椒", emoji: "🌶️", desc: "熱情奔放刺激直接" },
  { id: "ginger", label: "薑", emoji: "🫚", desc: "辛辣溫暖越陳越香" },
  { id: "cinnamon", label: "肉桂", emoji: "🟫", desc: "溫暖甜蜜充滿魅力" },
  { id: "garlic", label: "大蒜", emoji: "🧄", desc: "個性鮮明存在感強" },
  { id: "turmeric", label: "薑黃", emoji: "💛", desc: "健康自然獨樹一幟" },
  { id: "vanilla", label: "香草", emoji: "🍦", desc: "溫和細膩百搭包容" },
  { id: "pepper", label: "黑胡椒", emoji: "⚫", desc: "低調深邃回味悠長" },
  { id: "cardamom", label: "荳蔻", emoji: "🌿", desc: "神秘複雜層次豐富" },
  { id: "basil", label: "羅勒", emoji: "🌱", desc: "清新自然充滿活力" },
];

const CARD_COLORS = [
  "border-l-red-500 bg-red-50",
  "border-l-orange-500 bg-orange-50",
  "border-l-yellow-600 bg-yellow-50",
  "border-l-amber-500 bg-amber-50",
  "border-l-lime-600 bg-lime-50",
  "border-l-green-500 bg-green-50",
  "border-l-teal-500 bg-teal-50",
  "border-l-stone-500 bg-stone-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SpiceType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SpiceTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "spice_type",
    defaultState: { entries: [], revealed: false },
  });

  const [spice, setSpice] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="spc-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as SpiceEntry[]).find((e) => e.userId === userId);
  const canSubmit = spice !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: SpiceEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      spice,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as SpiceEntry[]), entry] });
    setSpice("");
    setReason("");
  };

  const entries = state.entries as SpiceEntry[];
  const revealed = state.revealed as boolean;

  const spiceCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.spice] = (acc[e.spice] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="spc-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種香料"}
      </div>
      <div data-testid="spc-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種香料，你最像哪種？說說你的香料個性！"}
      </div>
      <div data-testid="spc-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="spc-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {SPICES.map((s) => (
              <button
                key={s.id}
                data-testid={`spc-spice-${s.id}`}
                onClick={() => setSpice(s.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${spice === s.id ? "border-red-500 bg-red-50 font-semibold" : "hover:border-red-400"}`}
              >
                <span className="text-2xl">{s.emoji}</span>
                <div className="font-medium text-center">{s.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{s.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="spc-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種香料最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="spc-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-red-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            調味！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="spc-my-entry" className="bg-red-50 rounded-xl p-3 border border-red-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{SPICES.find((s) => s.id === myEntry.spice)?.emoji}</span>
            <span className="text-sm font-semibold">{SPICES.find((s) => s.id === myEntry.spice)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已加入</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="spc-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-red-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊香料架
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="spc-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇香料類型
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="spc-result" className="flex flex-col gap-3">
          <div data-testid="spc-spice-summary" className="flex flex-wrap gap-2">
            {SPICES.filter((s) => spiceCounts[s.id] > 0).map((s) => (
              <div
                key={s.id}
                data-testid={`spc-badge-${s.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold"
              >
                {s.emoji} {s.label}
                <span className="ml-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {spiceCounts[s.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="spc-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const s = SPICES.find((x) => x.id === e.spice);
              return (
                <div
                  key={e.entryId}
                  data-testid={`spc-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
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
