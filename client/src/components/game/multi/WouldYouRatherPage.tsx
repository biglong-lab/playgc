import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import WouldYouRather from "./WouldYouRather";
import type {
  WouldYouRatherConfig,
  WouldYouRatherState,
  WyrVote,
} from "./WouldYouRather";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface WouldYouRatherPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: WouldYouRatherConfig = {
  title: "🤔 你選哪個？",
  optionA: "永遠只能在家工作",
  emojiA: "🏠",
  optionB: "永遠只能在辦公室工作",
  emojiB: "🏢",
  showVoterNames: true,
};

const DEFAULT_STATE: WouldYouRatherState = {
  votes: [],
  revealed: false,
};

export default function WouldYouRatherPage({ page, sessionId, gameId, pageId }: WouldYouRatherPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: WouldYouRatherConfig } | WouldYouRatherConfig | null) ?? null;
  const config: WouldYouRatherConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as WouldYouRatherConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<WouldYouRatherState>({
    gameId,
    sessionId,
    pageId,
    type: "would_you_rather",
    defaultState: DEFAULT_STATE,
  });

  const handleVote = useCallback(
    async (choice: "A" | "B") => {
      if (!myUserId || state.votes.some((v: WyrVote) => v.userId === myUserId)) return;
      const newVote: WyrVote = {
        userId: myUserId,
        userName: myUserName,
        choice,
        votedAt: Date.now(),
      };
      await updateState({ ...state, votes: [...state.votes, newVote] });
    },
    [myUserId, myUserName, state, updateState]
  );

  const handleReveal = useCallback(async () => {
    if (state.revealed) return;
    await updateState({ ...state, revealed: true });
  }, [state, updateState]);

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
    <WouldYouRather
      config={config}
      state={state}
      myUserId={myUserId}
      onVote={handleVote}
      onReveal={handleReveal}
    />
  );
}
