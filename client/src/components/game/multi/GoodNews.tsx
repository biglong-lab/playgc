import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface NewsEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  news: string;
  category: string;
}

interface GoodNewsState extends Record<string, unknown> {
  entries: NewsEntry[];
  revealed: boolean;
}

interface GoodNewsConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): GoodNewsConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const CATEGORIES = [
  { id: "achievement", label: "工作成就", emoji: "🏆" },
  { id: "growth", label: "個人成長", emoji: "🌱" },
  { id: "family", label: "家庭生活", emoji: "🏠" },
  { id: "skill", label: "新技能", emoji: "⚡" },
  { id: "lucky", label: "好事降臨", emoji: "🍀" },
  { id: "experience", label: "精彩體驗", emoji: "🎉" },
];

const CARD_GRADIENTS = [
  "from-emerald-50 to-teal-50 border-emerald-200",
  "from-sky-50 to-blue-50 border-sky-200",
  "from-violet-50 to-purple-50 border-violet-200",
  "from-amber-50 to-yellow-50 border-amber-200",
  "from-rose-50 to-pink-50 border-rose-200",
  "from-lime-50 to-green-50 border-lime-200",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function GoodNews({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<GoodNewsState>({
    gameId,
    sessionId,
    pageId,
    type: "good_news",
    defaultState: { entries: [], revealed: false },
  });

  const [news, setNews] = useState("");
  const [category, setCategory] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="gn-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as NewsEntry[]).find((e) => e.userId === userId);
  const canSubmit = news.trim().length >= 5 && category !== "";

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: NewsEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      news: news.trim(),
      category,
    };
    updateState({ ...state, entries: [...(state.entries as NewsEntry[]), entry] });
    setNews("");
    setCategory("");
  };

  const entries = state.entries as NewsEntry[];
  const revealed = state.revealed as boolean;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="gn-title" className="text-xl font-bold text-center">
        {cfg.title ?? "好消息分享"}
      </div>
      <div data-testid="gn-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "分享一個最近讓你開心的好消息或美好事物！"}
      </div>
      <div data-testid="gn-count" className="text-xs text-center text-muted-foreground">
        已分享 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="gn-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                data-testid={`gn-cat-${c.id}`}
                onClick={() => setCategory(c.id)}
                className={`flex flex-col items-center p-2 rounded-xl border text-xs transition-all ${category === c.id ? "border-primary bg-primary/10 font-semibold" : "hover:border-primary/50"}`}
              >
                <span className="text-xl mb-1">{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
          <textarea
            data-testid="gn-news-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={3}
            placeholder="分享你的好消息（至少5字）..."
            value={news}
            onChange={(e) => setNews(e.target.value)}
          />
          <button
            data-testid="gn-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-emerald-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            分享好消息
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="gn-my-entry" className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
          <div className="text-xs text-emerald-600 mb-1">
            {CATEGORIES.find((c) => c.id === myEntry.category)?.emoji}{" "}
            {CATEGORIES.find((c) => c.id === myEntry.category)?.label}
          </div>
          <div className="text-sm font-medium">{myEntry.news}</div>
          <div className="text-xs text-muted-foreground mt-1">已分享</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="gn-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊好消息
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="gn-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人分享好消息
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="gn-result" className="flex flex-col gap-4">
          <div data-testid="gn-news-wall" className="flex flex-col gap-3">
            {entries.map((e, i) => {
              const cat = CATEGORIES.find((c) => c.id === e.category);
              return (
                <div
                  key={e.entryId}
                  data-testid={`gn-card-${e.entryId}`}
                  className={`rounded-xl p-4 border bg-gradient-to-br ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{cat?.emoji}</span>
                    <span className="text-xs font-medium text-muted-foreground">{cat?.label}</span>
                    <span className="ml-auto text-xs font-semibold">{e.userName}</span>
                  </div>
                  <div className="text-sm">{e.news}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
