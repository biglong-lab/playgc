import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { CascadeVote } from "./CascadeVote";
import type { CascadeVoteConfig, CascadeVoteState, CascadeAnswer } from "./CascadeVote";

const DEFAULT_CONFIG: CascadeVoteConfig = {
  title: "連續投票",
  questions: [
    {
      questionId: "q1",
      text: "你今天的狀態如何？",
      options: ["精力充沛", "普通", "有點累"],
    },
    {
      questionId: "q2",
      text: "你對這次活動的期待？",
      options: ["非常期待", "還好", "看情況"],
    },
  ],
};

function extractConfig(raw: Record<string, unknown>): CascadeVoteConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    questions: Array.isArray(raw.questions)
      ? (raw.questions as CascadeVoteConfig["questions"])
      : DEFAULT_CONFIG.questions,
  };
}

const DEFAULT_STATE: CascadeVoteState = {
  currentIndex: 0,
  answers: [],
  finished: false,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CascadeVotePage({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const config = extractConfig(rawConfig ?? DEFAULT_CONFIG);

  const { state, updateState, isLoaded } = useTeamPagePersistence<CascadeVoteState>({
    gameId,
    sessionId,
    pageId,
    type: "cascade_vote",
    defaultState: DEFAULT_STATE,
  });

  function handleAnswer(questionId: string, optionIndex: number) {
    const already = state.answers.some(
      (a) => a.questionId === questionId && a.userId === userId,
    );
    if (already) return;
    const entry: CascadeAnswer = {
      answerId: `${userId}-${questionId}`,
      userId,
      userName,
      questionId,
      optionIndex,
    };
    updateState({ ...state, answers: [...state.answers, entry] });
  }

  function handleAdvance() {
    const next = Math.min(state.currentIndex + 1, config.questions.length - 1);
    updateState({ ...state, currentIndex: next });
  }

  function handleFinish() {
    updateState({ ...state, finished: true });
  }

  return (
    <CascadeVote
      config={config}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      isLoaded={isLoaded}
      onAnswer={handleAnswer}
      onAdvance={handleAdvance}
      onFinish={handleFinish}
    />
  );
}

export default CascadeVotePage;
