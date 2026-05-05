import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import QuoteWall, { QuoteWallConfig, QuoteWallState, QuoteEntry } from "./QuoteWall";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: QuoteWallState = { quotes: [], revealed: false };

export default function QuoteWallPage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<QuoteWallState>({
    gameId,
    sessionId,
    pageId,
    type: "quote_wall",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: QuoteWallConfig =
    "placeholder" in r
      ? (r as unknown as QuoteWallConfig)
      : r.config && "placeholder" in (r.config as Record<string, unknown>)
        ? (r.config as unknown as QuoteWallConfig)
        : { title: "名言牆", prompt: "分享你最喜歡的一句話", maxLength: 100, placeholder: "例如：凡走過，必留下痕跡" };

  const myUserId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(text: string, author: string) {
    const already = state.quotes.some((q) => q.userId === myUserId);
    if (already) return;
    const entry: QuoteEntry = {
      quoteId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName,
      text,
      author,
    };
    updateState({ ...state, quotes: [...state.quotes, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <QuoteWall
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
