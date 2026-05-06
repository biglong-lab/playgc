import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ElementEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  element: string;
  reason: string;
}

interface ElementalTypeState extends Record<string, unknown> {
  entries: ElementEntry[];
  revealed: boolean;
}

interface ElementalTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): ElementalTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const ELEMENTS = [
  { id: "fire", label: "火焰", emoji: "🔥", desc: "熱情衝勁點燃一切" },
  { id: "water", label: "流水", emoji: "💧", desc: "柔韌靈活滋養萬物" },
  { id: "earth", label: "大地", emoji: "🌍", desc: "穩重踏實承載一切" },
  { id: "wind", label: "風", emoji: "🌬️", desc: "自由流動帶來變化" },
  { id: "lightning", label: "雷電", emoji: "⚡", desc: "爆發力強瞬間改變" },
  { id: "ice", label: "冰雪", emoji: "❄️", desc: "冷靜清晰精煉純粹" },
  { id: "light", label: "光明", emoji: "✨", desc: "正向溫暖照亮他人" },
  { id: "shadow", label: "暗影", emoji: "🌑", desc: "神秘深邃洞察人心" },
];

const CARD_COLORS = [
  "border-l-red-400 bg-red-50",
  "border-l-blue-400 bg-blue-50",
  "border-l-green-400 bg-green-50",
  "border-l-sky-400 bg-sky-50",
  "border-l-yellow-400 bg-yellow-50",
  "border-l-cyan-400 bg-cyan-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-purple-400 bg-purple-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ElementalType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ElementalTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "elemental_type",
    defaultState: { entries: [], revealed: false },
  });

  const [element, setElement] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="et-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as ElementEntry[]).find((e) => e.userId === userId);
  const canSubmit = element !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: ElementEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      element,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as ElementEntry[]), entry] });
    setElement("");
    setReason("");
  };

  const entries = state.entries as ElementEntry[];
  const revealed = state.revealed as boolean;

  const elementCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.element] = (acc[e.element] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="et-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種元素"}
      </div>
      <div data-testid="et-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是自然界的一種元素，你最像哪個？說說你的原因！"}
      </div>
      <div data-testid="et-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="et-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-2">
            {ELEMENTS.map((el) => (
              <button
                key={el.id}
                data-testid={`et-element-${el.id}`}
                onClick={() => setElement(el.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${element === el.id ? "border-indigo-400 bg-indigo-50 font-semibold" : "hover:border-indigo-300"}`}
              >
                <span className="text-xl shrink-0">{el.emoji}</span>
                <div className="text-left">
                  <div className="font-medium">{el.label}</div>
                  <div className="text-muted-foreground text-[10px]">{el.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="et-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這個元素最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="et-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            召喚元素！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="et-my-entry" className="bg-indigo-50 rounded-xl p-3 border border-indigo-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{ELEMENTS.find((el) => el.id === myEntry.element)?.emoji}</span>
            <span className="text-sm font-semibold">{ELEMENTS.find((el) => el.id === myEntry.element)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已召喚</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="et-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊元素圖鑑
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="et-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇元素
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="et-result" className="flex flex-col gap-3">
          <div data-testid="et-element-summary" className="flex flex-wrap gap-2">
            {ELEMENTS.filter((el) => elementCounts[el.id] > 0).map((el) => (
              <div
                key={el.id}
                data-testid={`et-badge-${el.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold"
              >
                {el.emoji} {el.label}
                <span className="ml-1 bg-indigo-400 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {elementCounts[el.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="et-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const el = ELEMENTS.find((x) => x.id === e.element);
              return (
                <div
                  key={e.entryId}
                  data-testid={`et-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{el?.emoji}</span>
                    <span className="text-sm font-semibold">{el?.label}</span>
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
