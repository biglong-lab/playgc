import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import PredictionPoll, {
  PredictionPollConfig,
  PredictionPollState,
  PollOption,
  UserPrediction,
  UserAnswer,
} from "./PredictionPoll";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_OPTIONS: PollOption[] = [
  { optionId: "a", label: "選項 A" },
  { optionId: "b", label: "選項 B" },
  { optionId: "c", label: "選項 C" },
];

const DEFAULT_CONFIG: PredictionPollConfig = {
  title: "預測投票",
  question: "大家的選擇是什麼？",
  options: DEFAULT_OPTIONS,
};

const DEFAULT_STATE: PredictionPollState = {
  predictions: [],
  answers: [],
  phase: "predict",
};

export default function PredictionPollPage({
  gameId,
  sessionId,
  pageId,
  page,
}: Props) {
  const { user } = useAuth();

  const raw = page?.config;
  const config: PredictionPollConfig =
    raw && typeof raw === "object" && "question" in raw
      ? (raw as PredictionPollConfig)
      : raw && typeof raw === "object" && "config" in raw
      ? (raw as { config: PredictionPollConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } =
    useTeamPagePersistence<PredictionPollState>({
      gameId,
      sessionId,
      pageId,
      type: "prediction_poll",
      defaultState: DEFAULT_STATE,
    });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-slate-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName =
    user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handlePredict(optionId: string) {
    if (
      state.predictions.find((p: UserPrediction) => p.userId === myUserId)
    )
      return;
    updateState({
      ...state,
      predictions: [
        ...state.predictions,
        {
          userId: myUserId,
          userName: myUserName,
          predictedOptionId: optionId,
        },
      ],
    });
  }

  function handleAnswer(optionId: string) {
    if (state.answers.find((a: UserAnswer) => a.userId === myUserId))
      return;
    updateState({
      ...state,
      answers: [
        ...state.answers,
        { userId: myUserId, answeredOptionId: optionId },
      ],
    });
  }

  function handleAdvancePhase() {
    const next: PredictionPollState["phase"] =
      state.phase === "predict" ? "answer" : "result";
    updateState({ ...state, phase: next });
  }

  return (
    <PredictionPoll
      config={config}
      state={state}
      myUserId={myUserId}
      onPredict={handlePredict}
      onAnswer={handleAnswer}
      onAdvancePhase={handleAdvancePhase}
    />
  );
}
