import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ScaledFeedback from "./ScaledFeedback";
import type {
  ScaledFeedbackConfig,
  ScaledFeedbackState,
  ScaledFeedbackResponse,
} from "./ScaledFeedback";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface ScaledFeedbackPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: ScaledFeedbackConfig = {
  title: "📊 量表評分",
  instructions: "請為以下項目評分",
  questions: [
    { id: "q1", text: "整體活動滿意度", minLabel: "非常不滿意", maxLabel: "非常滿意" },
    { id: "q2", text: "活動流程順暢程度", minLabel: "非常不順", maxLabel: "非常流暢" },
    { id: "q3", text: "您的參與投入程度", minLabel: "完全沒投入", maxLabel: "完全投入" },
  ],
  scale: 5,
  showResults: true,
};

const DEFAULT_STATE: ScaledFeedbackState = { responses: [] };

export default function ScaledFeedbackPage({ page, sessionId, gameId, pageId }: ScaledFeedbackPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: ScaledFeedbackConfig } | ScaledFeedbackConfig | null) ?? null;
  const config: ScaledFeedbackConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as ScaledFeedbackConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<ScaledFeedbackState>({
    gameId,
    sessionId,
    pageId,
    type: "scaled_feedback",
    defaultState: DEFAULT_STATE,
  });

  const [localRatings, setLocalRatings] = useState<Record<string, number>>({});

  const handleRatingChange = useCallback((questionId: string, value: number) => {
    setLocalRatings((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (state.responses.some((r: ScaledFeedbackResponse) => r.userId === myUserId)) return;
    const newResponse: ScaledFeedbackResponse = {
      userId: myUserId,
      userName: myUserName,
      ratings: { ...localRatings },
      submittedAt: Date.now(),
    };
    await updateState({ ...state, responses: [...state.responses, newResponse] });
  }, [state, myUserId, myUserName, localRatings, updateState]);

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
    <ScaledFeedback
      config={config}
      state={state}
      myUserId={myUserId}
      localRatings={localRatings}
      onRatingChange={handleRatingChange}
      onSubmit={handleSubmit}
    />
  );
}
