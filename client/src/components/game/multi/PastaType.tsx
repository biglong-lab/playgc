import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface PastaEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  pasta: string;
  reason: string;
}

interface PastaTypeState extends Record<string, unknown> {
  entries: PastaEntry[];
  revealed: boolean;
}

interface PastaTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): PastaTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const PASTAS = [
  { id: "spaghetti", label: "義大利麵", emoji: "🍝", desc: "細長延伸充滿彈性" },
  { id: "penne", label: "斜管麵", emoji: "🖊️", desc: "俐落直接目標清晰" },
  { id: "fusilli", label: "螺旋麵", emoji: "🌀", desc: "靈活旋轉充滿活力" },
  { id: "lasagna", label: "千層麵", emoji: "📚", desc: "層層豐富多面深度" },
  { id: "ravioli", label: "義大利餃", emoji: "🥟", desc: "內斂包容驚喜藏心" },
  { id: "fettuccine", label: "寬麵", emoji: "🎀", desc: "寬厚穩重包容萬事" },
  { id: "rigatoni", label: "肋管麵", emoji: "🔵", desc: "紮實有力飽滿充沛" },
  { id: "gnocchi", label: "麵疙瘩", emoji: "☁️", desc: "柔軟溫暖家的味道" },
  { id: "tagliatelle", label: "蛋麵", emoji: "🌾", desc: "金黃絲滑細膩優雅" },
];

const CARD_COLORS = [
  "border-l-orange-500 bg-orange-50",
  "border-l-red-500 bg-red-50",
  "border-l-amber-500 bg-amber-50",
  "border-l-yellow-500 bg-yellow-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-red-400 bg-red-50",
  "border-l-amber-600 bg-amber-50",
  "border-l-orange-600 bg-orange-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PastaType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<PastaTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "pasta_type",
    defaultState: { entries: [], revealed: false },
  });

  const [pasta, setPasta] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="pst-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as PastaEntry[]).find((e) => e.userId === userId);
  const canSubmit = pasta !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: PastaEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      pasta,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as PastaEntry[]), entry] });
    setPasta("");
    setReason("");
  };

  const entries = state.entries as PastaEntry[];
  const revealed = state.revealed as boolean;

  const pastaCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.pasta] = (acc[e.pasta] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="pst-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種義大利麵"}
      </div>
      <div data-testid="pst-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種義大利麵，你最像哪種？說說你的義麵個性！"}
      </div>
      <div data-testid="pst-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="pst-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {PASTAS.map((p) => (
              <button
                key={p.id}
                data-testid={`pst-pasta-${p.id}`}
                onClick={() => setPasta(p.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${pasta === p.id ? "border-orange-500 bg-orange-50 font-semibold" : "hover:border-orange-400"}`}
              >
                <span className="text-2xl">{p.emoji}</span>
                <div className="font-medium text-center">{p.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{p.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="pst-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種義大利麵最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="pst-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-orange-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            烹煮！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="pst-my-entry" className="bg-orange-50 rounded-xl p-3 border border-orange-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{PASTAS.find((p) => p.id === myEntry.pasta)?.emoji}</span>
            <span className="text-sm font-semibold">{PASTAS.find((p) => p.id === myEntry.pasta)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已上桌</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="pst-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-orange-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊義大利麵館
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="pst-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇義大利麵
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="pst-result" className="flex flex-col gap-3">
          <div data-testid="pst-pasta-summary" className="flex flex-wrap gap-2">
            {PASTAS.filter((p) => pastaCounts[p.id] > 0).map((p) => (
              <div
                key={p.id}
                data-testid={`pst-badge-${p.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold"
              >
                {p.emoji} {p.label}
                <span className="ml-1 bg-orange-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {pastaCounts[p.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="pst-card-list" className="flex flex-col gap-2">
            {entries.map((e, idx) => {
              const p = PASTAS.find((x) => x.id === e.pasta);
              return (
                <div
                  key={e.entryId}
                  data-testid={`pst-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{p?.emoji}</span>
                    <span className="text-sm font-semibold">{p?.label}</span>
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
