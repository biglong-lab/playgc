import { useState } from "react";
import { Loader2, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface HeadlineEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  headline: string;
  detail: string;
}

interface HeadlineNewsState extends Record<string, unknown> {
  entries: HeadlineEntry[];
  revealed: boolean;
}

interface HeadlineNewsConfig {
  title?: string;
  prompt?: string;
  timeframe?: string;
}

function extractConfig(raw: Record<string, unknown>): HeadlineNewsConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "未來頭條",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "想像六個月後，你希望看到什麼新聞標題？",
    timeframe: typeof raw.timeframe === "string" ? raw.timeframe : "6 個月後",
  };
}

const PAPER_COLORS = [
  "from-yellow-50 to-amber-50 border-amber-200",
  "from-blue-50 to-sky-50 border-sky-200",
  "from-green-50 to-emerald-50 border-emerald-200",
  "from-purple-50 to-violet-50 border-violet-200",
  "from-rose-50 to-pink-50 border-pink-200",
];

export interface HeadlineNewsProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function HeadlineNews({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: HeadlineNewsProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<HeadlineNewsState>({
    gameId,
    sessionId,
    pageId,
    type: "headline_news",
    defaultState: { entries: [], revealed: false },
  });

  const [headline, setHeadline] = useState("");
  const [detail, setDetail] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="hn-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!headline.trim() || myEntry) return;
    const entry: HeadlineEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      headline: headline.trim(),
      detail: detail.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setHeadline("");
    setDetail("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <Newspaper className="w-6 h-6 text-amber-600" />
        <h2 className="text-xl font-bold" data-testid="hn-title">
          {cfg.title ?? "未來頭條"}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="hn-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-center text-muted-foreground italic" data-testid="hn-timeframe">
        📅 {cfg.timeframe} 的報紙
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="hn-count">
        已提交：{state.entries.length} 份
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="大標題（例：「○○團隊成功達成...」）"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={60}
            data-testid="hn-headline-input"
          />
          <Textarea
            placeholder="副標題或內文（選填）"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={2}
            maxLength={150}
            data-testid="hn-detail-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!headline.trim()}
            className="w-full"
            data-testid="hn-submit-btn"
          >
            發佈頭條
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm" data-testid="hn-my-entry">
          <p className="font-bold text-amber-800">📰 {myEntry.headline}</p>
          {myEntry.detail && <p className="text-muted-foreground mt-1 text-xs">{myEntry.detail}</p>}
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-3" data-testid="hn-result">
          {state.entries.length === 0 ? (
            <p className="text-center text-muted-foreground" data-testid="hn-empty">
              尚無頭條
            </p>
          ) : (
            state.entries.map((entry, idx) => (
              <div
                key={entry.entryId}
                data-testid={`hn-entry-${entry.entryId}`}
                className={`rounded-xl border p-4 bg-gradient-to-br ${PAPER_COLORS[idx % PAPER_COLORS.length]}`}
              >
                <div className="text-xs text-muted-foreground mb-1 font-medium">{entry.userName} — 記者</div>
                <p className="font-bold text-base leading-snug">📰 {entry.headline}</p>
                {entry.detail && (
                  <p className="text-sm text-muted-foreground mt-1 leading-snug">{entry.detail}</p>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="hn-reveal-btn">
            發佈所有頭條
          </Button>
        )
      )}
    </div>
  );
}

export default HeadlineNews;
