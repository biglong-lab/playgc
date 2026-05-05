import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import HotSeat, {
  type HotSeatConfig,
  type HotSeatState,
  type HotSeatSession,
  type HotSeatQuestion,
} from "./HotSeat";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface HotSeatPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: HotSeatConfig = {
  title: "🔥 熱烤椅",
  instructions: "一人上場，全場提問！換你了嗎？",
  durationSeconds: 180,
  maxQuestionsPerRound: 5,
};

const DEFAULT_STATE: HotSeatState = { current: null, history: [], volunteers: [] };

export default function HotSeatPage({ page, sessionId, gameId, pageId }: HotSeatPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: HotSeatConfig } | HotSeatConfig | null) ?? null;
  const config: HotSeatConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as HotSeatConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<HotSeatState>({
    gameId,
    sessionId,
    pageId,
    type: "hot_seat",
    defaultState: DEFAULT_STATE,
  });

  const [draftQuestion, setDraftQuestion] = useState("");

  const handleVolunteer = useCallback(async () => {
    const alreadyVolunteering = state.volunteers.some((v) => v.userId === myUserId);
    if (alreadyVolunteering || state.current?.userId === myUserId) return;

    const newVolunteers = [...state.volunteers, { userId: myUserId, userName: myUserName }];
    const newCurrent = state.current ?? { userId: myUserId, userName: myUserName, startedAt: Date.now(), questions: [] };
    const updatedVolunteers = state.current ? newVolunteers : state.volunteers.filter((v) => v.userId !== myUserId);

    await updateState({ ...state, current: newCurrent, volunteers: updatedVolunteers });
  }, [state, myUserId, myUserName, updateState]);

  const handleAskQuestion = useCallback(async () => {
    if (!draftQuestion.trim() || !state.current) return;
    const newQuestion: HotSeatQuestion = {
      id: `${myUserId}-${Date.now()}`,
      askerId: myUserId,
      askerName: myUserName,
      text: draftQuestion.trim(),
      askedAt: Date.now(),
    };
    const updatedCurrent: HotSeatSession = {
      ...state.current,
      questions: [...state.current.questions, newQuestion],
    };
    await updateState({ ...state, current: updatedCurrent });
    setDraftQuestion("");
  }, [state, myUserId, myUserName, draftQuestion, updateState]);

  const handleEndRound = useCallback(async () => {
    if (!state.current || state.current.userId !== myUserId) return;
    const completed = state.current;
    const remainingVolunteers = state.volunteers.filter((v) => v.userId !== myUserId);
    const nextPerson = remainingVolunteers[0] ?? null;
    const newCurrent: HotSeatSession | null = nextPerson
      ? { userId: nextPerson.userId, userName: nextPerson.userName, startedAt: Date.now(), questions: [] }
      : null;
    const newVolunteers = nextPerson ? remainingVolunteers.slice(1) : remainingVolunteers;
    await updateState({
      ...state,
      current: newCurrent,
      history: [...state.history, completed],
      volunteers: newVolunteers,
    });
  }, [state, myUserId, updateState]);

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
    <HotSeat
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      draftQuestion={draftQuestion}
      onDraftChange={setDraftQuestion}
      onVolunteer={handleVolunteer}
      onAskQuestion={handleAskQuestion}
      onEndRound={handleEndRound}
    />
  );
}
