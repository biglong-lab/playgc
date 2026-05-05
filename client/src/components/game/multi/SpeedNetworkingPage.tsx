import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import SpeedNetworking, {
  type SpeedNetworkingConfig,
  type SpeedNetworkingState,
  type NetworkingParticipant,
} from "./SpeedNetworking";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface SpeedNetworkingPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: SpeedNetworkingConfig = {
  title: "⚡ 速配社交",
  prompt: "輪流和不同人對話，認識新朋友！",
  roundDurationSeconds: 120,
  questions: [
    "你現在最專注的一件事是什麼？",
    "這次活動你最期待什麼？",
    "用一個詞描述你自己？",
  ],
  showMatchedCount: true,
};

const DEFAULT_STATE: SpeedNetworkingState = {
  participants: [],
  currentRound: 1,
  roundStartedAt: null,
  phase: "waiting",
};

export default function SpeedNetworkingPage({ page, sessionId, gameId, pageId }: SpeedNetworkingPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: SpeedNetworkingConfig } | SpeedNetworkingConfig | null) ?? null;
  const config: SpeedNetworkingConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as SpeedNetworkingConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<SpeedNetworkingState>({
    gameId,
    sessionId,
    pageId,
    type: "speed_networking",
    defaultState: DEFAULT_STATE,
  });

  const handleJoin = useCallback(async () => {
    const already = state.participants.find((p) => p.userId === myUserId);
    if (already) return;
    const newP: NetworkingParticipant = {
      userId: myUserId,
      userName: myUserName,
      matches: [],
      joinedAt: Date.now(),
    };
    await updateState({ ...state, participants: [...state.participants, newP] });
  }, [state, myUserId, myUserName, updateState]);

  const handleMatchConfirm = useCallback(
    async (targetUserId: string) => {
      const targetP = state.participants.find((p) => p.userId === targetUserId);
      if (!targetP) return;

      const updatedParticipants = state.participants.map((p) => {
        if (p.userId !== myUserId) return p;
        const alreadyMatched = p.matches.some((m) => m.userId === targetUserId);
        if (alreadyMatched) return p;
        return {
          ...p,
          matches: [...p.matches, { userId: targetUserId, userName: targetP.userName, matchedAt: Date.now() }],
        };
      });
      await updateState({ ...state, participants: updatedParticipants });
    },
    [state, myUserId, updateState],
  );

  const handleNextRound = useCallback(async () => {
    const nextRound = state.currentRound + 1;
    const maxRounds = Math.max(state.participants.length - 1, 1);
    if (nextRound > maxRounds) {
      await updateState({ ...state, phase: "done", currentRound: nextRound });
    } else {
      await updateState({ ...state, currentRound: nextRound, roundStartedAt: Date.now() });
    }
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
    <SpeedNetworking
      config={config}
      state={state}
      myUserId={myUserId}
      onJoin={handleJoin}
      onMatchConfirm={handleMatchConfirm}
      onNextRound={handleNextRound}
    />
  );
}
