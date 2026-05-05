// 🎰 LuckyDrawPage — pageType="lucky_draw" 容器（L3 持久化）
import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import LuckyDraw, {
  type LuckyDrawConfig,
  type LuckyDrawState,
  type Participant,
  type DrawResult,
} from "./LuckyDraw";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface LuckyDrawPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: LuckyDrawConfig = {
  title: "🎰 幸運抽獎",
  subtitle: "期待您的大獎！",
  prizes: [
    { id: "p1", name: "一等獎", emoji: "🏆", quantity: 1 },
    { id: "p2", name: "二等獎", emoji: "🎁", quantity: 2 },
    { id: "p3", name: "三等獎", emoji: "🎀", quantity: 3 },
  ],
  drawText: "抽！",
  suspenseText: "幸運兒是…",
};

const DEFAULT_STATE: LuckyDrawState = {
  phase: "register",
  participants: [],
  results: [],
  hostUserId: null,
};

export default function LuckyDrawPage({ page, sessionId, gameId, pageId, onComplete }: LuckyDrawPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: LuckyDrawConfig } | LuckyDrawConfig | null) ?? null;
  const config: LuckyDrawConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as LuckyDrawConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<LuckyDrawState>({
    gameId, sessionId, pageId, type: "lucky_draw", defaultState: DEFAULT_STATE,
  });

  const handleJoin = useCallback(async () => {
    const already = state.participants.some((p: Participant) => p.userId === myUserId);
    if (already) return;
    const newParticipant: Participant = { userId: myUserId, userName: myUserName, joinedAt: Date.now() };
    await updateState({ ...state, participants: [...state.participants, newParticipant] });
  }, [state, myUserId, myUserName, updateState]);

  const handleStartDraw = useCallback(async () => {
    if (state.phase !== "register") return;
    await updateState({ ...state, phase: "drawing", hostUserId: myUserId });
  }, [state, myUserId, updateState]);

  const handleDraw = useCallback(async (prizeId: string) => {
    // 排除已中獎者（一人一獎）
    const wonUserIds = new Set(state.results.map((r: DrawResult) => r.winnerId));
    const eligible = state.participants.filter((p: Participant) => !wonUserIds.has(p.userId));
    if (eligible.length === 0) return;

    const winner = eligible[Math.floor(Math.random() * eligible.length)];
    const prize = config.prizes.find((p) => p.id === prizeId);
    if (!prize) return;

    const newResult: DrawResult = {
      prizeId,
      prizeName: prize.name,
      prizeEmoji: prize.emoji,
      winnerId: winner.userId,
      winnerName: winner.userName,
      drawnAt: Date.now(),
    };
    await updateState({ ...state, results: [...state.results, newResult] });
  }, [state, config.prizes, updateState]);

  const handleFinish = useCallback(async () => {
    await updateState({ ...state, phase: "done" });
    if (onComplete) onComplete();
  }, [state, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <LuckyDraw
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onJoin={handleJoin}
      onStartDraw={handleStartDraw}
      onDraw={handleDraw}
      onFinish={handleFinish}
    />
  );
}
