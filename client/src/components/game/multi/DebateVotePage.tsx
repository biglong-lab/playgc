// 🗳️ DebateVotePage — pageType="debate_vote" 容器（L3 持久化）
import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import DebateVote, {
  type DebateVoteConfig,
  type DebateVoteState,
  type DebateVoteEntry,
} from "./DebateVote";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface DebateVotePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: DebateVoteConfig = {
  title: "🗳️ 即時辯論投票",
  topic: "AI 將取代大多數人類工作",
  proLabel: "正方：同意",
  conLabel: "反方：不同意",
  proEmoji: "👍",
  conEmoji: "👎",
  showVoterCount: true,
  allowSwitch: true,
};

const DEFAULT_STATE: DebateVoteState = {
  votes: [],
};

export default function DebateVotePage({ page, sessionId, gameId, pageId }: DebateVotePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: DebateVoteConfig } | DebateVoteConfig | null) ?? null;
  const config: DebateVoteConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as DebateVoteConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<DebateVoteState>({
    gameId,
    sessionId,
    pageId,
    type: "debate_vote",
    defaultState: DEFAULT_STATE,
  });

  const handleVote = useCallback(
    async (side: "pro" | "con") => {
      const existing = state.votes.find((v: DebateVoteEntry) => v.userId === myUserId);
      if (existing?.side === side) return;

      const newEntry: DebateVoteEntry = {
        userId: myUserId,
        userName: myUserName,
        side,
        votedAt: Date.now(),
        switchCount: existing ? (existing.switchCount ?? 0) + 1 : 0,
      };
      const filtered = state.votes.filter((v: DebateVoteEntry) => v.userId !== myUserId);
      await updateState({ ...state, votes: [...filtered, newEntry] });
    },
    [state, myUserId, myUserName, updateState],
  );

  if (!isLoaded) {
    return (
      <Card className="m-4">
        <CardContent className="flex items-center gap-2 py-4">
          <Loader2 className="animate-spin w-4 h-4" />
          <span>載入中…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <DebateVote
      config={config}
      state={state}
      myUserId={myUserId}
      onVote={handleVote}
    />
  );
}
