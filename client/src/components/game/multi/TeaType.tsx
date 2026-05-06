import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface TeaEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  tea: string;
  reason: string;
}

interface TeaTypeState extends Record<string, unknown> {
  entries: TeaEntry[];
  revealed: boolean;
}

interface TeaTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): TeaTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const TEAS = [
  { id: "green", label: "綠茶", emoji: "🍵", desc: "清新爽口思維清晰" },
  { id: "black", label: "紅茶", emoji: "🫖", desc: "溫暖醇厚穩定可靠" },
  { id: "oolong", label: "烏龍茶", emoji: "🍂", desc: "兼容並蓄中庸之道" },
  { id: "matcha", label: "抹茶", emoji: "🌿", desc: "深度專注精益求精" },
  { id: "herbal", label: "花草茶", emoji: "🌸", desc: "療癒溫柔關懷他人" },
  { id: "puerh", label: "普洱茶", emoji: "🧧", desc: "沉澱歲月越陳越香" },
  { id: "white", label: "白茶", emoji: "⚪", desc: "低調純粹靜靜發光" },
  { id: "jasmine", label: "茉莉花茶", emoji: "💐", desc: "優雅芬芳帶來好心情" },
  { id: "bubble", label: "珍珠奶茶", emoji: "🧋", desc: "多元混搭活潑驚喜" },
];

const CARD_COLORS = [
  "border-l-green-400 bg-green-50",
  "border-l-teal-400 bg-teal-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-lime-400 bg-lime-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-orange-400 bg-orange-50",
  "border-l-rose-400 bg-rose-50",
  "border-l-pink-400 bg-pink-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeaType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<TeaTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "tea_type",
    defaultState: { entries: [], revealed: false },
  });

  const [tea, setTea] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="tea-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as TeaEntry[]).find((e) => e.userId === userId);
  const canSubmit = tea !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: TeaEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      tea,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as TeaEntry[]), entry] });
    setTea("");
    setReason("");
  };

  const entries = state.entries as TeaEntry[];
  const revealed = state.revealed as boolean;

  const teaCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.tea] = (acc[e.tea] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="tea-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種茶"}
      </div>
      <div data-testid="tea-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種茶，你最像哪一種？說說你的茶道個性！"}
      </div>
      <div data-testid="tea-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="tea-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {TEAS.map((t) => (
              <button
                key={t.id}
                data-testid={`tea-type-${t.id}`}
                onClick={() => setTea(t.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${tea === t.id ? "border-green-500 bg-green-50 font-semibold" : "hover:border-green-400"}`}
              >
                <span className="text-2xl">{t.emoji}</span>
                <div className="font-medium text-center">{t.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{t.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="tea-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種茶最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="tea-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-green-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            泡茶！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="tea-my-entry" className="bg-green-50 rounded-xl p-3 border border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{TEAS.find((t) => t.id === myEntry.tea)?.emoji}</span>
            <span className="text-sm font-semibold">{TEAS.find((t) => t.id === myEntry.tea)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已泡好</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="tea-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-green-700 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊茶單
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="tea-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇茶飲
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="tea-result" className="flex flex-col gap-3">
          <div data-testid="tea-type-summary" className="flex flex-wrap gap-2">
            {TEAS.filter((t) => teaCounts[t.id] > 0).map((t) => (
              <div
                key={t.id}
                data-testid={`tea-badge-${t.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold"
              >
                {t.emoji} {t.label}
                <span className="ml-1 bg-green-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {teaCounts[t.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="tea-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const t = TEAS.find((x) => x.id === e.tea);
              return (
                <div
                  key={e.entryId}
                  data-testid={`tea-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{t?.emoji}</span>
                    <span className="text-sm font-semibold">{t?.label}</span>
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
