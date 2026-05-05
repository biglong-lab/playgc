// 🏃 ChoiceVerifyRacePage — ChoiceVerifyRace 元件的容器
//
// 2026-05-04 重設計：「server 統一推進、確保所有玩家同一時間看到題目」
//   - 玩家進場 → sendRaceInit → server 取或建 state、回 race_state（含 startAt）
//   - server 統一 timer 推進（依 secondsPerQuestion）→ broadcast race_question_advanced
//   - 玩家答題 → server 記分數、broadcast race_answered
//   - 最後一題結束 → server broadcast race_complete + 全員分數
//   - 答完留在最後畫面繼續倒數、時間到一起進下一題（不卡住）

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface RaceStateWsMessage {
  type: "race_state";
  currentQuestionIndex: number;
  totalQuestions: number;
  secondsPerQuestion: number;
  startAt: number;
  endAt: number;
  answers: RaceAnswerRecord[];
  members: { userId: string; displayName: string }[];
  completed: boolean;
}

interface RaceQuestionAdvancedWsMessage {
  type: "race_question_advanced";
  currentQuestionIndex: number;
  totalQuestions: number;
  secondsPerQuestion: number;
  startAt: number;
  endAt: number;
}

interface RaceCompleteWsMessage {
  type: "race_complete";
  totalQuestions: number;
  scores: Record<string, number>;
  members: { userId: string; displayName: string }[];
}

export interface ChoiceVerifyRacePageProps {
  config: ChoiceVerifyConfig;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
  sessionId: string;
  gameId: string;
  /** 🆕 2026-05-04: 給 server race state 當 key */
  pageId: string;
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
  sessionId,
  gameId,
  pageId,
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

  const [answerRecords, setAnswerRecords] = useState<RaceAnswerRecord[]>([]);
  // 🆕 2026-05-04: server-driven race state（取代 client 自管 currentQIndex）
  const [serverCurrentQIndex, setServerCurrentQIndex] = useState(0);
  const [serverEndAt, setServerEndAt] = useState<number | null>(null);
  const [raceCompleted, setRaceCompleted] = useState(false);
  const [finalScores, setFinalScores] = useState<Record<string, number> | null>(null);
  const initSentRef = useRef(false);
  const completeFiredRef = useRef(false);

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

  // 訂閱 WebSocket race_* 訊息
  const handleWsMessage = useCallback(
    (msg: { type: string }) => {
      if (msg.type === "race_state") {
        const m = msg as unknown as RaceStateWsMessage;
        setServerCurrentQIndex(m.currentQuestionIndex);
        setServerEndAt(m.endAt);
        if (m.answers.length > 0) setAnswerRecords(m.answers); // catch up 中途進場
        if (m.completed) setRaceCompleted(true);
        return;
      }
      if (msg.type === "race_question_advanced") {
        const m = msg as unknown as RaceQuestionAdvancedWsMessage;
        setServerCurrentQIndex(m.currentQuestionIndex);
        setServerEndAt(m.endAt);
        return;
      }
      if (msg.type === "race_complete") {
        const m = msg as unknown as RaceCompleteWsMessage;
        setRaceCompleted(true);
        setFinalScores(m.scores);
        return;
      }
      if (msg.type === "race_answered") {
        const m = msg as unknown as RaceAnsweredWsMessage;
        if (m.userId === user?.id) return; // 自己的答題已 local 加進
        setAnswerRecords((prev) => {
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
      }
    },
    [user],
  );

  const { sendRaceAnswer, sendRaceInit, isConnected } = useTeamWebSocket({
    teamId: myTeam?.id,
    userId: user?.id,
    userName: myDisplayName,
    onMessage: handleWsMessage,
  });

  // 🆕 2026-05-04: 連線後立即發 race_init 通知 server（server 取或建 state）
  useEffect(() => {
    if (!isConnected) return;
    if (!user || !myTeam) return;
    if (initSentRef.current) return;
    initSentRef.current = true;
    const totalQuestions = config.questions?.length ?? 1;
    // 🆕 預設 20 秒、admin 可在 config.questionTimeLimit 覆寫（5-120 軟邊界）
    const secondsPerQuestion = Math.max(
      5,
      Math.min(config.questionTimeLimit ?? 20, 120),
    );
    sendRaceInit({
      displayName: myDisplayName,
      sessionId,
      pageId,
      totalQuestions,
      secondsPerQuestion,
    });
  }, [isConnected, user, myTeam, config, sessionId, pageId, myDisplayName, sendRaceInit]);

  // 🆕 2026-05-04: race 完成 → 等 1.5 秒讓玩家看分數 → onComplete
  useEffect(() => {
    if (!raceCompleted || completeFiredRef.current || !user) return;
    completeFiredRef.current = true;
    const myScore = finalScores?.[user.id] ?? 0;
    const timer = setTimeout(() => {
      onComplete({ points: myScore }, config.nextPageId);
    }, 1500);
    return () => clearTimeout(timer);
  }, [raceCompleted, finalScores, user, onComplete, config.nextPageId]);

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

      sendRaceAnswer({
        displayName: myDisplayName,
        questionIndex,
        selectedOption: optionIndex,
        isCorrect,
        points,
        sessionId,
        pageId,
      });
    },
    [user, config, myDisplayName, sendRaceAnswer, sessionId, pageId],
  );

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
        <CardContent className="p-6 text-center space-y-3">
          <Users className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium">此元件需要組隊使用</p>
          <p className="text-xs text-muted-foreground">
            請回到場域首頁建立或加入隊伍
          </p>
          {/* 🆕 2026-05-05: admin 預覽 / 測試時直接連到 DevTools 模擬玩家 */}
          <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 p-3 text-left text-xs space-y-1">
            <p className="font-semibold text-purple-900 dark:text-purple-100">🧪 admin 測試多人？</p>
            <p className="text-purple-800 dark:text-purple-200">
              用「開發者工具」建測試玩家、用 N 個 incognito 視窗模擬完整多人流程
            </p>
            <a
              href="/admin/dev-tools"
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-1 text-purple-700 dark:text-purple-400 underline"
              data-testid="link-to-dev-tools"
            >
              → 開啟開發者工具
            </a>
          </div>
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
      // 🆕 2026-05-04: server-driven 同步
      serverCurrentQIndex={serverCurrentQIndex}
      serverEndAt={serverEndAt}
      raceCompleted={raceCompleted}
      finalScores={finalScores}
    />
  );
}
