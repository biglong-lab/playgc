import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import MostLikely from "./MostLikely";
import type {
  MostLikelyConfig,
  MostLikelyState,
  MostLikelyParticipant,
  MostLikelyVote,
} from "./MostLikely";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface MostLikelyPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: MostLikelyConfig = {
  title: "👑 最有可能",
  questions: [
    "最有可能熬夜打遊戲的人？",
    "最有可能在公司開會打瞌睡的人？",
    "最有可能帶大家去好吃餐廳的人？",
  ],
  showResults: true,
};

const DEFAULT_STATE: MostLikelyState = {
  participants: [],
  votes: [],
  currentQuestionIndex: 0,
  revealed: false,
};

export default function MostLikelyPage({ page, sessionId, gameId, pageId }: MostLikelyPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: MostLikelyConfig } | MostLikelyConfig | null) ?? null;
  const config: MostLikelyConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as MostLikelyConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<MostLikelyState>({
    gameId,
    sessionId,
    pageId,
    type: "most_likely",
    defaultState: DEFAULT_STATE,
  });

  const handleJoin = useCallback(async () => {
    const already = state.participants.some((p: MostLikelyParticipant) => p.userId === myUserId);
    if (already) return;
    const newParticipant: MostLikelyParticipant = { userId: myUserId, userName: myUserName };
    await updateState({
      ...state,
      participants: [...state.participants, newParticipant],
    });
  }, [state, myUserId, myUserName, updateState]);

  const handleNominate = useCallback(
    async (nomineeId: string) => {
      const already = state.votes.some(
        (v: MostLikelyVote) => v.voterId === myUserId && v.questionIndex === state.currentQuestionIndex
      );
      if (already || state.revealed) return;
      const nominee = state.participants.find((p: MostLikelyParticipant) => p.userId === nomineeId);
      if (!nominee) return;
      const newVote: MostLikelyVote = {
        voterId: myUserId,
        questionIndex: state.currentQuestionIndex,
        nomineeId,
        nomineeName: nominee.userName,
      };
      await updateState({ ...state, votes: [...state.votes, newVote] });
    },
    [state, myUserId, updateState]
  );

  const handleReveal = useCallback(async () => {
    if (state.revealed) return;
    await updateState({ ...state, revealed: true });
  }, [state, updateState]);

  const handleNext = useCallback(async () => {
    const nextIndex = state.currentQuestionIndex + 1;
    await updateState({ ...state, currentQuestionIndex: nextIndex, revealed: false });
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
    <MostLikely
      config={config}
      state={state}
      myUserId={myUserId}
      onJoin={handleJoin}
      onNominate={handleNominate}
      onReveal={handleReveal}
      onNext={handleNext}
    />
  );
}
