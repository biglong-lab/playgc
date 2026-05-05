import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import AgreementMatrix, {
  type AgreementMatrixConfig,
  type AgreementMatrixState,
  type MatrixResponse,
} from "./AgreementMatrix";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface AgreementMatrixPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: AgreementMatrixConfig = {
  title: "📊 觀點評分",
  instructions: "請對以下陳述表達你的意見",
  statements: [
    { id: "s1", text: "團隊溝通暢通，資訊透明" },
    { id: "s2", text: "工作流程效率高，少有阻礙" },
    { id: "s3", text: "個人成長機會充足" },
    { id: "s4", text: "整體工作環境讓我感到滿意" },
  ],
  showResults: true,
};

const DEFAULT_STATE: AgreementMatrixState = { responses: [] };

export default function AgreementMatrixPage({ page, sessionId, gameId, pageId }: AgreementMatrixPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: AgreementMatrixConfig } | AgreementMatrixConfig | null) ?? null;
  const config: AgreementMatrixConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as AgreementMatrixConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<AgreementMatrixState>({
    gameId,
    sessionId,
    pageId,
    type: "agreement_matrix",
    defaultState: DEFAULT_STATE,
  });

  const [localRatings, setLocalRatings] = useState<Record<string, number>>({});

  const handleRate = useCallback((statementId: string, value: number) => {
    setLocalRatings((prev) => ({ ...prev, [statementId]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (state.responses.some((r: MatrixResponse) => r.userId === myUserId)) return;
    const newResponse: MatrixResponse = {
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
    <AgreementMatrix
      config={config}
      state={state}
      myUserId={myUserId}
      localRatings={localRatings}
      onRate={handleRate}
      onSubmit={handleSubmit}
    />
  );
}
