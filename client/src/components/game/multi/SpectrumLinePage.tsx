import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import SpectrumLine, {
  type SpectrumLineConfig,
  type SpectrumLineState,
  type SpectrumPlacement,
} from "./SpectrumLine";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface SpectrumLinePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: SpectrumLineConfig = {
  title: "🎯 你在光譜的哪裡？",
  instructions: "拖動滑桿，告訴大家你的工作風格",
  questions: [
    { id: "q1", leftLabel: "內向", rightLabel: "外向", leftEmoji: "🤫", rightEmoji: "📢" },
    { id: "q2", leftLabel: "計畫型", rightLabel: "即興型", leftEmoji: "📋", rightEmoji: "🎲" },
    { id: "q3", leftLabel: "細節控", rightLabel: "大方向派", leftEmoji: "🔍", rightEmoji: "🌍" },
    { id: "q4", leftLabel: "獨立作業", rightLabel: "團隊合作", leftEmoji: "🧘", rightEmoji: "🤝" },
  ],
  showResults: true,
  showNames: true,
};

const DEFAULT_STATE: SpectrumLineState = { placements: [] };

export default function SpectrumLinePage({ page, sessionId, gameId, pageId }: SpectrumLinePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: SpectrumLineConfig } | SpectrumLineConfig | null) ?? null;
  const config: SpectrumLineConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as SpectrumLineConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<SpectrumLineState>({
    gameId,
    sessionId,
    pageId,
    type: "spectrum_line",
    defaultState: DEFAULT_STATE,
  });

  const [localPositions, setLocalPositions] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const q of config.questions) initial[q.id] = 50;
    return initial;
  });

  const handlePositionChange = useCallback((questionId: string, position: number) => {
    setLocalPositions((prev) => ({ ...prev, [questionId]: position }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (state.placements.some((p: SpectrumPlacement) => p.userId === myUserId)) return;
    const newPlacement: SpectrumPlacement = {
      userId: myUserId,
      userName: myUserName,
      positions: { ...localPositions },
      submittedAt: Date.now(),
    };
    await updateState({ ...state, placements: [...state.placements, newPlacement] });
  }, [state, myUserId, myUserName, localPositions, updateState]);

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
    <SpectrumLine
      config={config}
      state={state}
      myUserId={myUserId}
      localPositions={localPositions}
      onPositionChange={handlePositionChange}
      onSubmit={handleSubmit}
    />
  );
}
