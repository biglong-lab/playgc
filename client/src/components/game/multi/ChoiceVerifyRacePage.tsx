// 🏃 ChoiceVerifyRacePage — ChoiceVerifyRace 元件的容器
//
// 角色：
//   - ChoiceVerifyRace（純 UI）的容器層
//   - 從 gameId 自動找隊伍 + 隊員清單
//   - 用 useTeamWebSocket 接 race_answered 訊息累積 answerRecords
//   - 玩家答題時呼叫 sendRaceAnswer 透過 WebSocket 廣播給同隊全員
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.6
//
// realtime 鏈路（2026-05-03 Phase 3.1 part 3 補完）：
//   1. client send "race_answer"（useTeamWebSocket.sendRaceAnswer）
//   2. server case "race_answer" → broadcastToTeam(teamId, "race_answered")
//   3. 隊員收到 → handleWsMessage 累積 answerRecords

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import ChoiceVerifyRace, {
  type RaceAnswerRecord,
  type RaceMemberInfo,
} from "./ChoiceVerifyRace";
import type { ChoiceVerifyConfig } from "@shared/schema";

/** Server 廣播 race_answered 訊息格式（part 3 client 準備接收，server 端 endpoint 待補） */
interface RaceAnsweredWsMessage {
  type: "race_answered";
  userId: string;
  displayName: string;
  questionIndex: number;
  selectedOption: number;
  isCorrect: boolean;
  answeredAt: string;
  points: number;
}

export interface ChoiceVerifyRacePageProps {
  config: ChoiceVerifyConfig;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
  sessionId: string;
  gameId: string;
}

interface MyTeamResponse {
  id: string;
  members: Array<{
    userId: string;
    user?: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email?: string;
    };
  }>;
}

function deriveDisplayName(
  member: MyTeamResponse["members"][number],
): string {
  const u = member.user;
  if (!u) return member.userId.slice(0, 8);
  const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (u.email) return u.email.split("@")[0];
  return u.id.slice(0, 8);
}

export default function ChoiceVerifyRacePage({
  config,
  onComplete,
  gameId,
}: ChoiceVerifyRacePageProps) {
  const { user } = useAuth();

  const {
    data: myTeam,
    isLoading: teamLoading,
    isError: teamError,
  } = useQuery<MyTeamResponse | null>({
    queryKey: [`/api/games/${gameId}/my-team`],
    enabled: !!gameId && !!user,
  });

  // 本地累積 answerRecords（含自己 handleAnswer + 隊友 race_answered 廣播）
  const [answerRecords, setAnswerRecords] = useState<RaceAnswerRecord[]>([]);

  const myDisplayName = useMemo(() => {
    if (!user) return "我";
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    if (fullName) return fullName;
    if (user.email) return user.email.split("@")[0];
    return user.id.slice(0, 8);
  }, [user]);

  const members: RaceMemberInfo[] = useMemo(
    () =>
      (myTeam?.members ?? []).map((m) => ({
        userId: m.userId,
        displayName: deriveDisplayName(m),
      })),
    [myTeam],
  );

  // 訂閱 WebSocket race_answered 訊息
  // 收到隊友答題訊息 → 加進 answerRecords（本地 + 隊友統一管理）
  const handleWsMessage = useCallback(
    (msg: { type: string }) => {
      if (msg.type !== "race_answered") return;
      const m = msg as unknown as RaceAnsweredWsMessage;
      // 自己的訊息不重複加（handleAnswer 本地已加）
      if (m.userId === user?.id) return;
      setAnswerRecords((prev) => {
        // 防重：同 user 同題不重複
        if (
          prev.some(
            (r) => r.userId === m.userId && r.questionIndex === m.questionIndex,
          )
        ) {
          return prev;
        }
        return [
          ...prev,
          {
            userId: m.userId,
            displayName: m.displayName,
            questionIndex: m.questionIndex,
            selectedOption: m.selectedOption,
            isCorrect: m.isCorrect,
            answeredAt: m.answeredAt,
            points: m.points,
          },
        ];
      });
    },
    [user],
  );

  const { sendRaceAnswer } = useTeamWebSocket({
    teamId: myTeam?.id,
    userId: user?.id,
    userName: myDisplayName,
    onMessage: handleWsMessage,
  });

  // 處理玩家答題：本地累積 + 透過 WebSocket 廣播給同隊全員
  const handleAnswer = useCallback(
    (questionIndex: number, optionIndex: number) => {
      if (!user) return;
      const question = config.questions?.[questionIndex];
      if (!question) return;

      const isCorrect = question.correctAnswer === optionIndex;
      const points = isCorrect ? (config.rewardPerQuestion ?? 10) : 0;

      const record: RaceAnswerRecord = {
        userId: user.id,
        displayName: myDisplayName,
        questionIndex,
        selectedOption: optionIndex,
        isCorrect,
        answeredAt: new Date().toISOString(),
        points,
      };
      setAnswerRecords((prev) => [...prev, record]);

      // 透過 WebSocket race_answer 廣播給同隊（server 廣播為 race_answered）
      sendRaceAnswer({
        displayName: myDisplayName,
        questionIndex,
        selectedOption: optionIndex,
        isCorrect,
        points,
      });
    },
    [user, config, myDisplayName, sendRaceAnswer],
  );

  // ============================================================================
  // Fallback UI
  // ============================================================================

  if (!user) {
    return (
      <Card data-testid="race-page-not-authed">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">請先登入後再使用</p>
        </CardContent>
      </Card>
    );
  }

  if (teamLoading) {
    return (
      <Card data-testid="race-page-loading">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          載入隊伍資訊中...
        </CardContent>
      </Card>
    );
  }

  if (teamError || !myTeam) {
    return (
      <Card data-testid="race-page-no-team">
        <CardContent className="p-6 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">此元件需要組隊使用</p>
          <p className="text-xs text-muted-foreground">
            請回到場域首頁建立或加入隊伍
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ChoiceVerifyRace
      config={config}
      myUserId={user.id}
      members={members}
      answerRecords={answerRecords}
      onAnswer={handleAnswer}
      onComplete={onComplete}
    />
  );
}
