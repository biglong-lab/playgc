import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ArtEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  style: string;
  reason: string;
}

interface ArtStyleState extends Record<string, unknown> {
  entries: ArtEntry[];
  revealed: boolean;
}

interface ArtStyleConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): ArtStyleConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const STYLES = [
  { id: "impressionism", label: "印象派", emoji: "🌅", desc: "感受當下光影變化" },
  { id: "abstract", label: "抽象藝術", emoji: "🔷", desc: "超越形式表達內在" },
  { id: "realism", label: "寫實主義", emoji: "🖼️", desc: "忠實呈現真實世界" },
  { id: "minimalism", label: "極簡主義", emoji: "⬜", desc: "少即是多簡約精準" },
  { id: "surrealism", label: "超現實主義", emoji: "🌀", desc: "夢境與現實交融共存" },
  { id: "pop_art", label: "普普藝術", emoji: "🎯", desc: "大眾流行勇於表達" },
  { id: "street_art", label: "街頭藝術", emoji: "🎨", desc: "自由叛逆打破規則" },
  { id: "watercolor", label: "水彩", emoji: "💧", desc: "細膩流動透明溫柔" },
  { id: "photography", label: "攝影", emoji: "📷", desc: "捕捉瞬間記錄真實" },
];

const CARD_COLORS = [
  "border-l-violet-500 bg-violet-50",
  "border-l-purple-500 bg-purple-50",
  "border-l-fuchsia-500 bg-fuchsia-50",
  "border-l-pink-500 bg-pink-50",
  "border-l-indigo-500 bg-indigo-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-cyan-400 bg-cyan-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ArtStyle({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ArtStyleState>({
    gameId,
    sessionId,
    pageId,
    type: "art_style",
    defaultState: { entries: [], revealed: false },
  });

  const [style, setStyle] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="art-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as ArtEntry[]).find((e) => e.userId === userId);
  const canSubmit = style !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: ArtEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      style,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as ArtEntry[]), entry] });
    setStyle("");
    setReason("");
  };

  const entries = state.entries as ArtEntry[];
  const revealed = state.revealed as boolean;

  const styleCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.style] = (acc[e.style] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="art-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種藝術風格"}
      </div>
      <div data-testid="art-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種藝術風格，你最像哪種？說說你的藝術個性！"}
      </div>
      <div data-testid="art-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="art-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                data-testid={`art-style-${s.id}`}
                onClick={() => setStyle(s.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${style === s.id ? "border-violet-500 bg-violet-50 font-semibold" : "hover:border-violet-400"}`}
              >
                <span className="text-2xl">{s.emoji}</span>
                <div className="font-medium text-center">{s.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{s.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="art-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種藝術風格最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="art-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-violet-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            創作！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="art-my-entry" className="bg-violet-50 rounded-xl p-3 border border-violet-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{STYLES.find((s) => s.id === myEntry.style)?.emoji}</span>
            <span className="text-sm font-semibold">{STYLES.find((s) => s.id === myEntry.style)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已展出</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="art-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-violet-600 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊藝廊
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="art-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇藝術風格
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="art-result" className="flex flex-col gap-3">
          <div data-testid="art-style-summary" className="flex flex-wrap gap-2">
            {STYLES.filter((s) => styleCounts[s.id] > 0).map((s) => (
              <div
                key={s.id}
                data-testid={`art-badge-${s.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold"
              >
                {s.emoji} {s.label}
                <span className="ml-1 bg-violet-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {styleCounts[s.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="art-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const s = STYLES.find((x) => x.id === e.style);
              return (
                <div
                  key={e.entryId}
                  data-testid={`art-card-${e.entryId}`}
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
