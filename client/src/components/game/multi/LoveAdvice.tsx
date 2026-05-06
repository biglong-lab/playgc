import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface AdviceEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  advice: string;
  category: string;
}

interface LoveAdviceState extends Record<string, unknown> {
  entries: AdviceEntry[];
  revealed: boolean;
}

interface LoveAdviceConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): LoveAdviceConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const CATEGORIES = [
  { id: "communication", label: "溝通技巧", emoji: "💬" },
  { id: "adventure", label: "共同冒險", emoji: "🗺️" },
  { id: "respect", label: "相互尊重", emoji: "🤝" },
  { id: "laughter", label: "保持歡笑", emoji: "😄" },
  { id: "support", label: "互相支持", emoji: "💪" },
  { id: "surprise", label: "製造驚喜", emoji: "🎁" },
];

const CARD_COLORS = [
  "border-l-rose-400 bg-rose-50",
  "border-l-pink-400 bg-pink-50",
  "border-l-red-400 bg-red-50",
  "border-l-orange-400 bg-orange-50",
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

export function LoveAdvice({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<LoveAdviceState>({
    gameId,
    sessionId,
    pageId,
    type: "love_advice",
    defaultState: { entries: [], revealed: false },
  });

  const [advice, setAdvice] = useState("");
  const [category, setCategory] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="la-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as AdviceEntry[]).find((e) => e.userId === userId);
  const canSubmit = advice.trim().length >= 5 && category !== "";

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: AdviceEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      advice: advice.trim(),
      category,
    };
    updateState({ ...state, entries: [...(state.entries as AdviceEntry[]), entry] });
    setAdvice("");
    setCategory("");
  };

  const entries = state.entries as AdviceEntry[];
  const revealed = state.revealed as boolean;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="la-title" className="text-xl font-bold text-center">
        {cfg.title ?? "愛的建議"}
      </div>
      <div data-testid="la-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "給新人最誠摯的一句話建議，祝福他們幸福美滿！"}
      </div>
      <div data-testid="la-count" className="text-xs text-center text-muted-foreground">
        已祝福 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="la-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                data-testid={`la-cat-${c.id}`}
                onClick={() => setCategory(c.id)}
                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all ${category === c.id ? "border-rose-400 bg-rose-50 font-semibold" : "hover:border-rose-300"}`}
              >
                <span className="text-xl mb-1">{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
          <textarea
            data-testid="la-advice-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={3}
            placeholder="輸入你的建議（至少5字）..."
            value={advice}
            onChange={(e) => setAdvice(e.target.value)}
          />
          <button
            data-testid="la-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-rose-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            送出祝福
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="la-my-entry" className="bg-rose-50 rounded-xl p-3 border border-rose-200">
          <div className="text-xs text-rose-500 mb-1">
            {CATEGORIES.find((c) => c.id === myEntry.category)?.emoji}{" "}
            {CATEGORIES.find((c) => c.id === myEntry.category)?.label}
          </div>
          <div className="text-sm font-medium">{myEntry.advice}</div>
          <div className="text-xs text-muted-foreground mt-1">已送出</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="la-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全場建議
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="la-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人送出祝福
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="la-result" className="flex flex-col gap-3">
          <div data-testid="la-advice-wall" className="flex flex-col gap-3">
            {entries.map((e, i) => {
              const cat = CATEGORIES.find((c) => c.id === e.category);
              return (
                <div
                  key={e.entryId}
                  data-testid={`la-card-${e.entryId}`}
                  className={`rounded-xl p-4 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{cat?.emoji}</span>
                    <span className="text-xs font-medium text-muted-foreground">{cat?.label}</span>
                    <span className="ml-auto text-xs font-semibold">{e.userName}</span>
                  </div>
                  <div className="text-sm italic">「{e.advice}」</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
