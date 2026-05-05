import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ChallengeBoard, {
  type ChallengeBoardConfig,
  type ChallengeBoardState,
  type Challenge,
} from "./ChallengeBoard";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface ChallengeBoardPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: ChallengeBoardConfig = {
  title: "⚡ 挑戰公告欄",
  prompt: "發布挑戰，看誰敢接！",
  maxChallengesPerPerson: 2,
  maxChallengeLength: 50,
  rewardEmoji: "⚡",
};

const DEFAULT_STATE: ChallengeBoardState = { challenges: [] };

export default function ChallengeBoardPage({ page, sessionId, gameId, pageId }: ChallengeBoardPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: ChallengeBoardConfig } | ChallengeBoardConfig | null) ?? null;
  const config: ChallengeBoardConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as ChallengeBoardConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<ChallengeBoardState>({
    gameId,
    sessionId,
    pageId,
    type: "challenge_board",
    defaultState: DEFAULT_STATE,
  });

  const [draftText, setDraftText] = useState("");

  const handlePost = useCallback(async () => {
    if (!draftText.trim()) return;
    const newChallenge: Challenge = {
      id: `${myUserId}-${Date.now()}`,
      creatorId: myUserId,
      creatorName: myUserName,
      text: draftText.trim(),
      acceptors: [],
      completors: [],
      createdAt: Date.now(),
    };
    await updateState({ ...state, challenges: [...state.challenges, newChallenge] });
    setDraftText("");
  }, [state, myUserId, myUserName, draftText, updateState]);

  const handleAccept = useCallback(
    async (challengeId: string) => {
      const updated = state.challenges.map((c: Challenge) => {
        if (c.id !== challengeId) return c;
        if (c.acceptors.includes(myUserId)) return c;
        return { ...c, acceptors: [...c.acceptors, myUserId] };
      });
      await updateState({ ...state, challenges: updated });
    },
    [state, myUserId, updateState],
  );

  const handleComplete = useCallback(
    async (challengeId: string) => {
      const updated = state.challenges.map((c: Challenge) => {
        if (c.id !== challengeId) return c;
        if (c.completors.includes(myUserId)) return c;
        return { ...c, completors: [...c.completors, myUserId] };
      });
      await updateState({ ...state, challenges: updated });
    },
    [state, myUserId, updateState],
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
    <ChallengeBoard
      config={config}
      state={state}
      myUserId={myUserId}
      draftText={draftText}
      onDraftChange={setDraftText}
      onPost={handlePost}
      onAccept={handleAccept}
      onComplete={handleComplete}
    />
  );
}
