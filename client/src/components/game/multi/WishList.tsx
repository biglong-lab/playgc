import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface WishEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  wish: string;
  category: string;
}

interface WishListState extends Record<string, unknown> {
  entries: WishEntry[];
  revealed: boolean;
}

interface WishListConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): WishListConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const WISH_CATEGORIES = [
  { id: "career", label: "事業發展", emoji: "💼" },
  { id: "travel", label: "旅行探索", emoji: "✈️" },
  { id: "skill", label: "技能學習", emoji: "🎯" },
  { id: "health", label: "健康生活", emoji: "💚" },
  { id: "relationship", label: "人際連結", emoji: "🤝" },
  { id: "creativity", label: "創作夢想", emoji: "🎨" },
];

const CARD_COLORS = [
  "border-l-pink-400 bg-pink-50",
  "border-l-sky-400 bg-sky-50",
  "border-l-emerald-400 bg-emerald-50",
  "border-l-amber-400 bg-amber-50",
  "border-l-violet-400 bg-violet-50",
  "border-l-rose-400 bg-rose-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function WishList({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<WishListState>({
    gameId,
    sessionId,
    pageId,
    type: "wish_list",
    defaultState: { entries: [], revealed: false },
  });

  const [wish, setWish] = useState("");
  const [category, setCategory] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="wl-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as WishEntry[]).find((e) => e.userId === userId);
  const canSubmit = wish.trim().length >= 5 && category !== "";

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: WishEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      wish: wish.trim(),
      category,
    };
    updateState({ ...state, entries: [...(state.entries as WishEntry[]), entry] });
    setWish("");
    setCategory("");
  };

  const entries = state.entries as WishEntry[];
  const revealed = state.revealed as boolean;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="wl-title" className="text-xl font-bold text-center">
        {cfg.title ?? "願望清單"}
      </div>
      <div data-testid="wl-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "許下一個你最想實現的願望，讓大家見證你的夢想！"}
      </div>
      <div data-testid="wl-count" className="text-xs text-center text-muted-foreground">
        已許願 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="wl-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {WISH_CATEGORIES.map((c) => (
              <button
                key={c.id}
                data-testid={`wl-cat-${c.id}`}
                onClick={() => setCategory(c.id)}
                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all ${category === c.id ? "border-pink-400 bg-pink-50 font-semibold" : "hover:border-pink-300"}`}
              >
                <span className="text-xl mb-1">{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
          <textarea
            data-testid="wl-wish-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={3}
            placeholder="寫下你的願望（至少5字）"
            value={wish}
            onChange={(e) => setWish(e.target.value)}
          />
          <button
            data-testid="wl-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-pink-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            許願！✨
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="wl-my-entry" className="bg-pink-50 rounded-xl p-3 border border-pink-200">
          <div className="text-xs text-pink-500 mb-1">
            {WISH_CATEGORIES.find((c) => c.id === myEntry.category)?.emoji}{" "}
            {WISH_CATEGORIES.find((c) => c.id === myEntry.category)?.label}
          </div>
          <div className="text-sm font-medium">{myEntry.wish}</div>
          <div className="text-xs text-muted-foreground mt-1">已許願 ✨</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="wl-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-pink-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊願望
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="wl-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人許願
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="wl-result" className="flex flex-col gap-3">
          <div data-testid="wl-wish-wall" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const cat = WISH_CATEGORIES.find((c) => c.id === e.category);
              return (
                <div
                  key={e.entryId}
                  data-testid={`wl-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{cat?.emoji}</span>
                    <span className="text-xs text-muted-foreground">{cat?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-sm font-medium">✨ {e.wish}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
