import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import MindSync, { MindSyncConfig, MindSyncState, MindAnswer } from "./MindSync";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: MindSyncConfig = {
  title: "默契大考驗",
  description: "獨立作答，揭曉後看看誰和你最有默契！",
  questions: ["最想去的地方？", "最愛的食物？", "最常做的事？"],
  maxAnswerLength: 15,
};

const DEFAULT_STATE: MindSyncState = {
  answers: [],
  revealed: false,
};

export default function MindSyncPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const rawConfig = page?.config;
  const config: MindSyncConfig =
    rawConfig && typeof rawConfig === "object" && "questions" in rawConfig
      ? (rawConfig as MindSyncConfig)
      : rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: MindSyncConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<MindSyncState>({
    gameId,
    sessionId,
    pageId,
    type: "mind_sync",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-purple-500" />
      </div>
    );
  }

  function handleSubmitAnswers(items: { questionIdx: number; answer: string }[]) {
    const newAnswers: MindAnswer[] = items.map((item) => ({
      answerId: `${myUserId}-${item.questionIdx}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      questionIdx: item.questionIdx,
      answer: item.answer,
    }));
    updateState({ ...state, answers: [...state.answers, ...newAnswers] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <MindSync
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmitAnswers={handleSubmitAnswers}
      onReveal={handleReveal}
    />
  );
}
