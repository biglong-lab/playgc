// 🏃 ChoiceVerifyRace — 隊伍搶答元件（多人對戰版）
//
// 與個人版 ChoiceVerify 的差異：
//   - 多題（questions[]）搶答：誰先答對誰得分（隊內競爭）
//   - 同隊每位玩家都看得到「誰先答對」的即時回饋
//   - 隊伍總分 = SUM(隊員個人分)
//   - 跨題連對 streak 加分（v2 留）
//
// 後端依賴（part 2 實作）：
//   - WebSocket "race_answered" 事件廣播每題答題紀錄
//   - server 用 timestamp 判定先後順序（避免 client clock skew）
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.6
//
// 測試友善：純 presentational + props 注入 answerRecords / onAnswer

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, XCircle, Trophy, Timer, Flame, Award,
} from "lucide-react";
import type { ChoiceVerifyConfig } from "@shared/schema";

// ============================================================================
// 型別
// ============================================================================

/** 隊員身份（用於排行榜） */
export interface RaceMemberInfo {
  userId: string;
  displayName: string;
}

/** 答題紀錄（每位玩家每題一筆） */
export interface RaceAnswerRecord {
  userId: string;
  displayName: string;
  questionIndex: number;
  selectedOption: number;
  isCorrect: boolean;
  answeredAt: string; // ISO timestamp
  points: number;
}

export interface ChoiceVerifyRaceProps {
  config: ChoiceVerifyConfig;
  myUserId: string;
  /** 隊員清單（用於排行榜顯示無答題者） */
  members: RaceMemberInfo[];
  /** 全部答題紀錄（server-driven） */
  answerRecords: RaceAnswerRecord[];
  /** 🆕 2026-05-05: server-driven props（替代 client-side useState） */
  /** 當前題號（server 統一推進） */
  currentQuestionIndex: number;
  /** 該題開始時間（ISO string）— client 用此算 timer remaining */
  questionStartedAt: string;
  /** 每題時限（秒） */
  secondsPerQuestion: number;
  /** 有人答對後的冷卻時間（秒）— UI 顯示「N 秒後下一題」倒數 */
  advanceCooldownSeconds: number;
  /** 第一個答對的時間戳（ISO string）；null = 該題尚未解決 */
  resolvedAt: string | null;
  /** 玩家答題（呼叫 server API） */
  onAnswer: (questionIndex: number, optionIndex: number) => void;
  /** 全部題目完成後呼叫（由父元件管、不再內部觸發） */
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
}

// ============================================================================
// 純函式 helpers（可單獨測試）
// ============================================================================

/** 取出指定題的所有答題紀錄（按時間排序） */
export function getRecordsForQuestion(
  records: RaceAnswerRecord[],
  questionIndex: number,
): RaceAnswerRecord[] {
  return records
    .filter((r) => r.questionIndex === questionIndex)
    .sort(
      (a, b) =>
        new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime(),
    );
}

/** 找出第一個答對該題的玩家 userId（誰先誰得分） */
export function getFirstCorrectUserId(
  records: RaceAnswerRecord[],
  questionIndex: number,
): string | null {
  const correctRecords = getRecordsForQuestion(records, questionIndex).filter(
    (r) => r.isCorrect,
  );
  return correctRecords[0]?.userId ?? null;
}

/** 計算玩家總分（只有「先答對」的紀錄計分） */
export function calcUserScore(
  records: RaceAnswerRecord[],
  userId: string,
): number {
  // 只計入該玩家「第一個答對」的紀錄（避免重複計分）
  const myFirstCorrects = new Map<number, number>(); // qIndex → points
  records
    .filter((r) => r.userId === userId && r.isCorrect)
    .forEach((r) => {
      // 確認自己是該題第一個答對
      const firstCorrectId = getFirstCorrectUserId(records, r.questionIndex);
      if (firstCorrectId === userId && !myFirstCorrects.has(r.questionIndex)) {
        myFirstCorrects.set(r.questionIndex, r.points);
      }
    });
  return Array.from(myFirstCorrects.values()).reduce((s, p) => s + p, 0);
}

/** 計算玩家答題數（不論對錯） */
export function calcUserAnswerCount(
  records: RaceAnswerRecord[],
  userId: string,
): number {
  return records.filter((r) => r.userId === userId).length;
}

/** 取隊內排行（依分數降序） */
export interface RaceRankingEntry {
  userId: string;
  displayName: string;
  score: number;
  answerCount: number;
  correctCount: number;
}

export function getRaceRanking(
  records: RaceAnswerRecord[],
  members: RaceMemberInfo[],
): RaceRankingEntry[] {
  return members
    .map((m) => {
      const myRecords = records.filter((r) => r.userId === m.userId);
      return {
        userId: m.userId,
        displayName: m.displayName,
        score: calcUserScore(records, m.userId),
        answerCount: myRecords.length,
        correctCount: myRecords.filter((r) => r.isCorrect).length,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.correctCount - a.correctCount;
    });
}

/** 玩家是否已對指定題答過（不能重答） */
export function hasUserAnswered(
  records: RaceAnswerRecord[],
  userId: string,
  questionIndex: number,
): boolean {
  return records.some(
    (r) => r.userId === userId && r.questionIndex === questionIndex,
  );
}

/** 判斷題目是否已被「結束」（有人答對 OR 全員都答過） */
export function isQuestionResolved(
  records: RaceAnswerRecord[],
  questionIndex: number,
  totalMembers: number,
): boolean {
  const qRecords = getRecordsForQuestion(records, questionIndex);
  if (qRecords.some((r) => r.isCorrect)) return true; // 有人答對
  if (qRecords.length >= totalMembers) return true; // 全員都答過
  return false;
}

// ============================================================================
// 主元件
// ============================================================================

export default function ChoiceVerifyRace({
  config,
  myUserId,
  members,
  answerRecords,
  currentQuestionIndex,
  questionStartedAt,
  secondsPerQuestion,
  advanceCooldownSeconds,
  resolvedAt,
  onAnswer,
  // onComplete 由父元件處理（接 server status='completed' 廣播）
}: ChoiceVerifyRaceProps) {
  const questions = config.questions ?? [];

  const currentQIndex = currentQuestionIndex;
  const currentQuestion = questions[currentQIndex];
  const isResolved = !!resolvedAt;

  // === Server-driven timer ===
  // 用 questionStartedAt + secondsPerQuestion 算題目剩餘時間
  // resolvedAt 有值時改顯示「N 秒後下一題」倒數
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const timerInfo = useMemo(() => {
    if (resolvedAt) {
      const resolvedTs = new Date(resolvedAt).getTime();
      const cooldownMs = advanceCooldownSeconds * 1000;
      const remainingMs = Math.max(0, cooldownMs - (now - resolvedTs));
      const remainingSec = Math.ceil(remainingMs / 1000);
      return {
        mode: "cooldown" as const,
        remainingSec,
        formatted: `下一題：${remainingSec}s`,
      };
    }
    const startTs = new Date(questionStartedAt).getTime();
    const limitMs = secondsPerQuestion * 1000;
    const remainingMs = Math.max(0, limitMs - (now - startTs));
    const remainingSec = Math.ceil(remainingMs / 1000);
    return {
      mode: "playing" as const,
      remainingSec,
      formatted: `${remainingSec}s`,
    };
  }, [resolvedAt, questionStartedAt, secondsPerQuestion, advanceCooldownSeconds, now]);

  // ============================================================================
  // Fallback UI
  // ============================================================================

  if (questions.length === 0) {
    return (
      <Card data-testid="choice-verify-race-empty">
        <CardContent className="p-6 text-center text-muted-foreground">
          尚無題目（請設定 questions 陣列）
        </CardContent>
      </Card>
    );
  }

  if (!currentQuestion) {
    return (
      <Card data-testid="choice-verify-race-no-current-question">
        <CardContent className="p-6 text-center text-muted-foreground">
          題目載入錯誤
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // 主要 UI
  // ============================================================================

  const myAlreadyAnswered = hasUserAnswered(answerRecords, myUserId, currentQIndex);
  const ranking = getRaceRanking(answerRecords, members);
  const myStat = ranking.find((r) => r.userId === myUserId);
  const firstCorrectId = getFirstCorrectUserId(answerRecords, currentQIndex);
  const firstCorrectMember = ranking.find((r) => r.userId === firstCorrectId);

  return (
    <div className="space-y-4" data-testid="choice-verify-race">
      {/* 標題 + 題號進度 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">
                {config.title ?? "隊伍搶答"}
              </h2>
            </div>
            <Badge variant="outline" className="font-number tabular-nums">
              第 {currentQIndex + 1} / {questions.length} 題
            </Badge>
          </div>
          <div className={`flex items-center gap-1 text-sm font-number tabular-nums ${
            timerInfo.mode === "cooldown" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground"
          }`}>
            <Timer className="w-4 h-4" />
            <span>{timerInfo.formatted}</span>
          </div>
        </CardContent>
      </Card>

      {/* 題目 + 選項 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-medium">{currentQuestion.question}</p>
          <div className="space-y-2">
            {currentQuestion.options.map((opt, idx) => {
              const isMyChoice = answerRecords.some(
                (r) =>
                  r.userId === myUserId &&
                  r.questionIndex === currentQIndex &&
                  r.selectedOption === idx,
              );
              const isCorrectAnswer = isResolved && currentQuestion.correctAnswer === idx;

              return (
                <Button
                  key={idx}
                  variant={
                    isCorrectAnswer
                      ? "default"
                      : isMyChoice
                        ? "secondary"
                        : "outline"
                  }
                  className="w-full justify-start h-auto py-3 px-4 text-left"
                  onClick={() => onAnswer(currentQIndex, idx)}
                  disabled={myAlreadyAnswered || isResolved}
                  data-testid={`race-option-${idx}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{opt}</span>
                    {isCorrectAnswer && <CheckCircle className="w-4 h-4 text-success" />}
                    {isMyChoice && !isCorrectAnswer && (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 題目結束狀態 */}
      {isResolved && firstCorrectMember && (
        <Card data-testid="race-resolved">
          <CardContent className="p-4 text-center">
            <Award className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-sm">
              <span className="font-medium">{firstCorrectMember.displayName}</span>
              {firstCorrectMember.userId === myUserId && (
                <span className="text-primary">（你）</span>
              )}{" "}
              先答對了！
            </p>
            {currentQuestion.explanation && (
              <p className="text-xs text-muted-foreground mt-2">
                {currentQuestion.explanation}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 進度條 */}
      <Progress
        value={((currentQIndex + (isResolved ? 1 : 0)) / questions.length) * 100}
        className="h-2"
      />

      {/* 我的貢獻 */}
      {myStat && (
        <Card data-testid="race-my-stat">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">你的成績</span>
              <span>
                <span className="font-number tabular-nums font-bold">
                  {myStat.score}
                </span>{" "}
                分 · {myStat.correctCount}/{myStat.answerCount} 正確
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 隊內排行 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5 mb-2 text-sm font-medium">
            <Trophy className="w-4 h-4 text-primary" />
            隊內排行
          </div>
          <div className="space-y-1" data-testid="race-ranking">
            {ranking.map((entry, idx) => {
              const isMe = entry.userId === myUserId;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
                    isMe ? "bg-primary/10 border border-primary/30" : ""
                  }`}
                  data-testid={`race-rank-${idx}`}
                >
                  <span className="w-5 text-center text-muted-foreground font-number tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="flex-1 font-medium truncate">
                    {entry.displayName}
                    {isMe && (
                      <span className="ml-1 text-xs text-primary">（你）</span>
                    )}
                  </span>
                  <span className="font-number tabular-nums text-muted-foreground">
                    {entry.correctCount}/{entry.answerCount}
                  </span>
                  <span className="font-number tabular-nums font-bold w-10 text-right">
                    {entry.score}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
