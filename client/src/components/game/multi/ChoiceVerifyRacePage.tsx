// 🏃 ChoiceVerifyRacePage — ChoiceVerifyRace 容器（2026-05-05 重寫）
//
// 解決問題（用戶實測痛點）：
//   ✓ 重整 → state 從 server DB 拉回（不會重來）
//   ✓ 答題進度同步 → server 統一 currentQuestionIndex、ws broadcast
//   ✓ 防重答 → DB UNIQUE 約束（client UI 也 disable）
//   ✓ 5 秒推進 → 第一個答對 → server 設 resolvedAt → client 倒數 5s → POST advance
//
// 架構：
//   1. mount 時 POST /api/team-race/state 建立或讀取 state（idempotent）
//   2. 訂閱 ws race_state_updated → 更新 local state
//   3. 答題：POST /api/team-race/answer（server 寫 DB + broadcast）
//   4. 第一個答對 → server resolvedAt 設、client UI 顯示倒數 5s
//   5. 5s 結束 → POST /api/team-race/advance（server conditional UPDATE 防 race）
//
// reconnect / refresh 處理：
//   - 任何時候 mount 都會 GET state、拿最新 currentQuestionIndex + answers
//   - ws reconnect → 訂閱 race_state_updated 自動更新
//   - 不會丟資料（DB 是 source of truth）

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useComponentTelemetry } from "@/hooks/useComponentTelemetry";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import ChoiceVerifyRace, {
  type RaceAnswerRecord,
  type RaceMemberInfo,
} from "./ChoiceVerifyRace";
import type { ChoiceVerifyConfig } from "@shared/schema";

interface RaceStateFromServer {
  id: string;
  teamId: string;
  sessionId: string;
  pageId: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  secondsPerQuestion: number;
  advanceCooldownSeconds: number;
  questionStartedAt: string;
  resolvedAt: string | null;
  status: "playing" | "completed";
  createdAt: string;
  updatedAt: string;
}

interface RaceAnswerFromServer {
  id: string;
  teamId: string;
  sessionId: string;
  pageId: string;
  userId: string;
  displayName: string;
  questionIndex: number;
  selectedOption: number;
  isCorrect: boolean;
  points: number;
  answeredAt: string;
}

interface RaceStateResponse {
  state: RaceStateFromServer | null;
  answers: RaceAnswerFromServer[];
}

export interface ChoiceVerifyRacePageProps {
  config: ChoiceVerifyConfig;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
  sessionId: string;
  gameId: string;
  pageId?: string;
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

/** server answer → client RaceAnswerRecord */
function toRecord(a: RaceAnswerFromServer): RaceAnswerRecord {
  return {
    userId: a.userId,
    displayName: a.displayName,
    questionIndex: a.questionIndex,
    selectedOption: a.selectedOption,
    isCorrect: a.isCorrect,
    answeredAt: a.answeredAt,
    points: a.points,
  };
}

export default function ChoiceVerifyRacePage({
  config,
  onComplete,
  sessionId,
  gameId,
  pageId,
}: ChoiceVerifyRacePageProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const totalQuestions = config.questions?.length ?? 0;
  const secondsPerQuestion = config.questionTimeLimit ?? 30;
  const advanceCooldownSeconds = config.advanceCooldownSeconds ?? 5;

  // 從 useQuery 取 myTeam
  const {
    data: myTeam,
    isLoading: teamLoading,
    isError: teamError,
  } = useQuery<MyTeamResponse | null>({
    queryKey: [`/api/games/${gameId}/my-team`],
    enabled: !!gameId && !!user,
  });

  const teamId = myTeam?.id;
  const effectivePageId = pageId ?? "default";

  // 📊 Phase 1 telemetry
  const tele = useComponentTelemetry({
    componentType: "choice_verify_race",
    sessionId, userId: user?.id, teamId, pageId: effectivePageId,
  });

  // === Server-driven state ===
  const [serverState, setServerState] = useState<RaceStateFromServer | null>(null);
  const [serverAnswers, setServerAnswers] = useState<RaceAnswerFromServer[]>([]);
  const [stateLoading, setStateLoading] = useState(true);
  const [stateError, setStateError] = useState<string | null>(null);
  // 🆕 2026-05-22 業主 docx #1：同步隊伍進度卡住、加 timeout + retry trigger
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const advanceFiredRef = useRef<Set<number>>(new Set()); // 已送 advance 的題號（防重複送）
  const onCompleteFiredRef = useRef(false);

  // 🛡️ 2026-05-05: state 衝突解決 — 比較 updatedAt + answers 數量
  //   POST /state（fetch）跟 ws broadcast（push）可能 race
  //   原則：採 (currentQuestionIndex 較新 OR updatedAt 較新 OR answers 較多) 的版本
  //   避免 fetch v1 蓋掉 broadcast v2 造成 state 倒退
  const applyServerStateIfNewer = useCallback(
    (incomingState: RaceStateFromServer | null, incomingAnswers: RaceAnswerFromServer[]) => {
      if (!incomingState) return;
      setServerState((prev) => {
        if (!prev) return incomingState;
        const prevUpdated = new Date(prev.updatedAt).getTime();
        const incomingUpdated = new Date(incomingState.updatedAt).getTime();
        // 進度較新 → 取新；progress 一樣但 updatedAt 較新 → 取新
        if (incomingState.currentQuestionIndex > prev.currentQuestionIndex) return incomingState;
        if (incomingState.currentQuestionIndex < prev.currentQuestionIndex) return prev;
        if (incomingState.status === "completed" && prev.status !== "completed") return incomingState;
        if (incomingState.status !== "completed" && prev.status === "completed") return prev;
        return incomingUpdated >= prevUpdated ? incomingState : prev;
      });
      setServerAnswers((prev) => {
        // answers 採「聯集」— 不丟舊紀錄、補新紀錄（防 fetch race 把已收到的新 answer 蓋回去）
        const map = new Map<string, RaceAnswerFromServer>();
        for (const a of prev) map.set(a.id, a);
        for (const a of incomingAnswers) map.set(a.id, a);
        return Array.from(map.values());
      });
    },
    [],
  );

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

  const answerRecords: RaceAnswerRecord[] = useMemo(
    () => serverAnswers.map(toRecord),
    [serverAnswers],
  );

  // === Mount: POST /state（idempotent upsert + 拉初始 state）===
  // teamId / sessionId / effectivePageId 一齊就 POST。重整也會走這條。
  const initStateMutation = useMutation({
    mutationFn: async (vars: {
      teamId: string;
      sessionId: string;
      pageId: string;
    }): Promise<RaceStateResponse> => {
      const res = await apiRequest("POST", "/api/team-race/state", {
        ...vars,
        totalQuestions,
        secondsPerQuestion,
        advanceCooldownSeconds,
      });
      return res.json();
    },
  });

  useEffect(() => {
    if (!teamId || !sessionId || !effectivePageId || totalQuestions === 0) return;
    let cancelled = false;
    setStateLoading(true);
    setStateError(null);
    setLoadingTooLong(false);
    // 🆕 2026-05-22 業主 docx #1：8 秒沒回應 → 顯示「載入較久」提示 + 重試
    const longLoadTimer = setTimeout(() => {
      if (!cancelled) setLoadingTooLong(true);
    }, 8000);
    initStateMutation
      .mutateAsync({ teamId, sessionId, pageId: effectivePageId })
      .then((data) => {
        if (cancelled) return;
        clearTimeout(longLoadTimer);
        applyServerStateIfNewer(data.state, data.answers);
        setStateLoading(false);
        setLoadingTooLong(false);
      })
      .catch((err) => {
        if (cancelled) return;
        clearTimeout(longLoadTimer);
        setStateError(err instanceof Error ? err.message : "載入狀態失敗");
        setStateLoading(false);
        setLoadingTooLong(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(longLoadTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, sessionId, effectivePageId, totalQuestions, retryCount]);

  // === WebSocket：race_state_updated 廣播 → 更新 state + answers ===
  const handleWsMessage = useCallback(
    (msg: { type: string }) => {
      if (msg.type !== "race_state_updated") return;
      const m = msg as unknown as {
        type: string;
        state: RaceStateFromServer;
        answers: RaceAnswerFromServer[];
      };
      applyServerStateIfNewer(m.state, m.answers);
    },
    [applyServerStateIfNewer],
  );

  const { isConnected: wsConnected, isReconnecting } = useTeamWebSocket({
    teamId,
    userId: user?.id,
    userName: myDisplayName,
    onMessage: handleWsMessage,
  });

  // === Polling fallback（10s 一次主動 GET state）===
  // 🛡️ 2026-05-05: 即使 ws 死、cache 卡、broadcast 漏 — 都能自動 reconcile
  //   只要該頁面活著就跑、status='completed' 後停
  //   合併用 applyServerStateIfNewer、不會蓋掉較新的 ws push
  useEffect(() => {
    if (!teamId || !sessionId || !effectivePageId) return;
    if (totalQuestions === 0) return;
    if (serverState?.status === "completed") return;
    const interval = setInterval(() => {
      apiRequest(
        "GET",
        `/api/team-race/state?teamId=${encodeURIComponent(teamId)}` +
          `&sessionId=${encodeURIComponent(sessionId)}` +
          `&pageId=${encodeURIComponent(effectivePageId)}`,
      )
        .then((r) => r.json())
        .then((data: RaceStateResponse) => {
          applyServerStateIfNewer(data.state, data.answers);
        })
        .catch(() => {
          /* 失敗忽略、下次 poll 會再試 */
        });
    }, 10_000);
    return () => clearInterval(interval);
  }, [teamId, sessionId, effectivePageId, totalQuestions, serverState?.status, applyServerStateIfNewer]);

  // === ws reconnect 後重新 fetch state（保證接回最新）===
  // 🛡️ 2026-05-05: 用 ref 標記是否真的「斷掉再連」（不是 mount 第一次連）
  //   原 bug：mount 時 wsConnected 可能 false→true 觸發 fetch、跟 mount-time fetch 重複
  //   修法：只在 prev=true → cur=false → cur=true 的軌跡才 fire
  const wsHadConnectedRef = useRef(false);
  const wsLastDisconnectAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!teamId || !sessionId || !effectivePageId || totalQuestions === 0) return;
    if (wsConnected) {
      // 連上：若曾斷過 → fetch state（接回最新）
      if (wsHadConnectedRef.current && wsLastDisconnectAtRef.current !== null) {
        initStateMutation
          .mutateAsync({ teamId, sessionId, pageId: effectivePageId })
          .then((data) => applyServerStateIfNewer(data.state, data.answers))
          .catch(() => {
            /* 失敗不阻塞、下次 ws 訊息會更新 */
          });
        wsLastDisconnectAtRef.current = null;
      }
      wsHadConnectedRef.current = true;
    } else {
      // 斷線：標記時間（ws 有連過才標、避免 mount 時 false 也標）
      if (wsHadConnectedRef.current) {
        wsLastDisconnectAtRef.current = Date.now();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsConnected, teamId, sessionId, effectivePageId, totalQuestions]);

  // === 答題 ===
  const answerMutation = useMutation({
    mutationFn: async (vars: {
      questionIndex: number;
      selectedOption: number;
      isCorrect: boolean;
      points: number;
    }): Promise<RaceStateResponse> => {
      if (!teamId) throw new Error("缺 teamId");
      const res = await apiRequest("POST", "/api/team-race/answer", {
        teamId,
        sessionId,
        pageId: effectivePageId,
        displayName: myDisplayName,
        ...vars,
      });
      return res.json();
    },
    onSuccess: (data) => {
      // 立即更新 local（雖 ws broadcast 也會送、雙保險）
      applyServerStateIfNewer(data.state, data.answers);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "答題失敗";
      toast({
        title: "答題失敗",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const handleAnswer = useCallback(
    (questionIndex: number, optionIndex: number) => {
      if (!user || !teamId) return;
      const question = config.questions?.[questionIndex];
      if (!question) return;
      const isCorrect = question.correctAnswer === optionIndex;
      const points = isCorrect ? (config.rewardPerQuestion ?? 10) : 0;
      answerMutation.mutate({
        questionIndex,
        selectedOption: optionIndex,
        isCorrect,
        points,
      });
    },
    [user, teamId, config, answerMutation],
  );

  // === 5 秒推進 ===
  // 觸發條件：state.resolvedAt 有值 + 還未 advance（防重複）
  // 任一 client 5 秒後送 POST advance；server conditional UPDATE 防 race
  const advanceMutation = useMutation({
    mutationFn: async (vars: { expectedQuestionIndex: number }): Promise<RaceStateResponse> => {
      if (!teamId) throw new Error("缺 teamId");
      const res = await apiRequest("POST", "/api/team-race/advance", {
        teamId,
        sessionId,
        pageId: effectivePageId,
        ...vars,
      });
      return res.json();
    },
    onSuccess: (data) => {
      applyServerStateIfNewer(data.state, data.answers);
    },
  });

  useEffect(() => {
    if (!serverState || !teamId) return;
    if (serverState.status === "completed") return;
    if (!serverState.resolvedAt) return;

    const qIdx = serverState.currentQuestionIndex;
    if (advanceFiredRef.current.has(qIdx)) return;

    const resolvedAt = new Date(serverState.resolvedAt).getTime();
    const cooldownMs = (serverState.advanceCooldownSeconds ?? 5) * 1000;
    const elapsed = Date.now() - resolvedAt;
    const remaining = Math.max(0, cooldownMs - elapsed);

    advanceFiredRef.current.add(qIdx);
    const timer = setTimeout(() => {
      advanceMutation.mutate({ expectedQuestionIndex: qIdx });
    }, remaining);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    serverState?.resolvedAt,
    serverState?.currentQuestionIndex,
    serverState?.status,
    teamId,
  ]);

  // === 題目時限到（無人答對的 fallback）===
  // server 端沒做 server-side timer、由 client 監測 questionStartedAt + secondsPerQuestion
  // 過了時限仍沒人答對 → 任一 client 送 advance（純超時推進）
  useEffect(() => {
    if (!serverState || !teamId) return;
    if (serverState.status === "completed") return;
    if (serverState.resolvedAt) return; // 有人答對由上面 useEffect 處理
    const qIdx = serverState.currentQuestionIndex;
    if (advanceFiredRef.current.has(qIdx)) return;

    const startedAt = new Date(serverState.questionStartedAt).getTime();
    const limitMs = (serverState.secondsPerQuestion ?? 30) * 1000;
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, limitMs - elapsed);

    const timer = setTimeout(() => {
      // 再次確認狀態還沒變（race condition）
      if (advanceFiredRef.current.has(qIdx)) return;
      advanceFiredRef.current.add(qIdx);
      advanceMutation.mutate({ expectedQuestionIndex: qIdx });
    }, remaining + 200); // +200ms buffer 給 server 時鐘漂移
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    serverState?.questionStartedAt,
    serverState?.currentQuestionIndex,
    serverState?.resolvedAt,
    serverState?.status,
    teamId,
  ]);

  // === completed → onComplete（只觸發一次）===
  useEffect(() => {
    if (!serverState || !user) return;
    if (serverState.status !== "completed") return;
    if (onCompleteFiredRef.current) return;
    onCompleteFiredRef.current = true;
    // 計算自己的總分
    const myScore = serverAnswers
      .filter((a) => a.userId === user.id && a.isCorrect)
      .reduce((sum, a) => {
        // 只算「該題第一個答對」的分
        const sortedQAnswers = serverAnswers
          .filter((x) => x.questionIndex === a.questionIndex && x.isCorrect)
          .sort(
            (l, r) =>
              new Date(l.answeredAt).getTime() - new Date(r.answeredAt).getTime(),
          );
        if (sortedQAnswers[0]?.userId === user.id) return sum + a.points;
        return sum;
      }, 0);
    tele.reportComplete("completed");
    setTimeout(() => {
      onComplete({ points: myScore }, config.nextPageId);
    }, 1500);
  }, [serverState?.status, serverAnswers, user, onComplete, config.nextPageId, tele]);

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

  if (stateLoading) {
    return (
      <Card data-testid="race-page-state-loading">
        <CardContent className="p-6 text-center space-y-3">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">同步隊伍進度中...</p>
          {/* 🆕 2026-05-22 業主 docx #1：8 秒沒回應顯示重試（之前永遠卡 spinner）*/}
          {loadingTooLong && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                載入時間較長、可能網路較慢或伺服器忙線
              </p>
              <button
                type="button"
                onClick={() => setRetryCount((n) => n + 1)}
                className="text-sm text-primary hover:underline"
                data-testid="button-race-retry"
              >
                🔄 重新嘗試同步
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (stateError || !serverState) {
    return (
      <Card data-testid="race-page-state-error">
        <CardContent className="p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
          <p className="text-sm text-muted-foreground">{stateError ?? "狀態載入失敗"}</p>
          {/* 🆕 2026-05-22 業主 docx #1：失敗也提供重試 */}
          <button
            type="button"
            onClick={() => setRetryCount((n) => n + 1)}
            className="text-sm text-primary hover:underline"
            data-testid="button-race-retry"
          >
            🔄 重新嘗試
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* WS 連線狀態 banner */}
      {!wsConnected && (
        <Card
          className="border-amber-300 bg-amber-50/80 dark:bg-amber-950/30"
          data-testid="race-ws-disconnected-banner"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <CardContent className="p-3 flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" aria-hidden="true" />
            <span className="text-amber-900 dark:text-amber-100">
              {isReconnecting
                ? "重新連線中…剛才的答題仍會自動同步"
                : "連線中斷、答題進度會在重連後自動同步"}
            </span>
          </CardContent>
        </Card>
      )}
      <ChoiceVerifyRace
        config={config}
        myUserId={user.id}
        members={members}
        answerRecords={answerRecords}
        currentQuestionIndex={serverState.currentQuestionIndex}
        questionStartedAt={serverState.questionStartedAt}
        secondsPerQuestion={serverState.secondsPerQuestion}
        advanceCooldownSeconds={serverState.advanceCooldownSeconds}
        resolvedAt={serverState.resolvedAt}
        onAnswer={handleAnswer}
        onComplete={onComplete}
      />
    </div>
  );
}
