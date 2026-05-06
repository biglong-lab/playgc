import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface FactEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  fact: string;
  category: string;
}

interface SpeedFactState extends Record<string, unknown> {
  entries: FactEntry[];
  revealed: boolean;
}

interface SpeedFactConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): SpeedFactConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const CATEGORIES = [
  { id: "talent", label: "隱藏才能", emoji: "🎭" },
  { id: "travel", label: "旅行故事", emoji: "✈️" },
  { id: "food", label: "奇特口味", emoji: "🍽️" },
  { id: "skill", label: "意外技能", emoji: "🔧" },
  { id: "dream", label: "有趣夢想", emoji: "💭" },
  { id: "record", label: "個人紀錄", emoji: "🏅" },
];

const CARD_COLORS = [
  "border-l-pink-400",
  "border-l-orange-400",
  "border-l-yellow-400",
  "border-l-green-400",
  "border-l-cyan-400",
  "border-l-indigo-400",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SpeedFact({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SpeedFactState>({
    gameId,
    sessionId,
    pageId,
    type: "speed_fact",
    defaultState: { entries: [], revealed: false },
  });

  const [fact, setFact] = useState("");
  const [category, setCategory] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="sf-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as FactEntry[]).find((e) => e.userId === userId);
  const canSubmit = fact.trim().length >= 5 && category !== "";

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: FactEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      fact: fact.trim(),
      category,
    };
    updateState({ ...state, entries: [...(state.entries as FactEntry[]), entry] });
    setFact("");
    setCategory("");
  };

  const entries = state.entries as FactEntry[];
  const revealed = state.revealed as boolean;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="sf-title" className="text-xl font-bold text-center">
        {cfg.title ?? "閃速事實"}
      </div>
      <div data-testid="sf-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "分享一個讓大家意想不到的關於你的小事實！"}
      </div>
      <div data-testid="sf-count" className="text-xs text-center text-muted-foreground">
        已提交 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="sf-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                data-testid={`sf-cat-${c.id}`}
                onClick={() => setCategory(c.id)}
                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all ${category === c.id ? "border-primary bg-primary/10 font-semibold" : "hover:border-primary/50"}`}
              >
                <span className="text-xl mb-1">{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
          <textarea
            data-testid="sf-fact-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={3}
            placeholder="輸入你的小事實（至少5字）..."
            value={fact}
            onChange={(e) => setFact(e.target.value)}
          />
          <button
            data-testid="sf-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            提交事實
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="sf-my-entry" className="bg-muted rounded-xl p-3 border">
          <div className="text-xs text-muted-foreground mb-1">
            {CATEGORIES.find((c) => c.id === myEntry.category)?.emoji}{" "}
            {CATEGORIES.find((c) => c.id === myEntry.category)?.label}
          </div>
          <div className="text-sm font-medium">{myEntry.fact}</div>
          <div className="text-xs text-muted-foreground mt-1">已提交</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="sf-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊事實
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="sf-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人提交事實
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="sf-result" className="flex flex-col gap-4">
          <div data-testid="sf-fact-wall" className="flex flex-col gap-3">
            {entries.map((e, i) => {
              const cat = CATEGORIES.find((c) => c.id === e.category);
              return (
                <div
                  key={e.entryId}
                  data-testid={`sf-card-${e.entryId}`}
                  className={`bg-card rounded-xl p-4 border border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{cat?.emoji}</span>
                    <span className="text-xs text-muted-foreground font-medium">{cat?.label}</span>
                    <span className="ml-auto text-xs font-semibold">{e.userName}</span>
                  </div>
                  <div className="text-sm">{e.fact}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
