import { useState } from "react";

export interface BuzzRecord extends Record<string, unknown> {
  buzzId: string;
  userId: string;
  userName: string;
  buzzedAt: number;
  result: "correct" | "wrong" | "pending";
  questionIndex: number;
}

export interface FastBuzzConfig extends Record<string, unknown> {
  title: string;
  questions: string[];
}

export interface FastBuzzState extends Record<string, unknown> {
  currentQuestionIndex: number;
  buzzes: BuzzRecord[];
  phase: "waiting" | "open" | "judging" | "done";
}

const PHASE_LABELS: Record<string, string> = {
  waiting: "等待開始",
  open: "🔔 搶答中！",
  judging: "判定中",
  done: "結束",
};

const DEFAULT_CONFIG: FastBuzzConfig = {
  title: "搶答競賽",
  questions: [],
};

interface Props {
  config: FastBuzzConfig;
  state: FastBuzzState;
  myUserId: string;
  onBuzz: () => void;
  onJudge: (buzzId: string, isCorrect: boolean) => void;
  onAdvance: () => void;
}

export default function FastBuzz({
  config,
  state,
  myUserId,
  onBuzz,
  onJudge,
  onAdvance,
}: Props) {
  const questions = config.questions ?? DEFAULT_CONFIG.questions;
  const { currentQuestionIndex, buzzes, phase } = state;

  const currentQ = questions[currentQuestionIndex] ?? "";
  const currentBuzzes = buzzes.filter(
    (b) => b.questionIndex === currentQuestionIndex
  );
  const sortedBuzzes = [...currentBuzzes].sort(
    (a, b) => a.buzzedAt - b.buzzedAt
  );
  const firstBuzz = sortedBuzzes[0];
  const myBuzzedThisQ = currentBuzzes.find((b) => b.userId === myUserId);

  const scoreMap: Record<string, { userName: string; score: number }> = {};
  for (const b of buzzes) {
    if (!scoreMap[b.userId]) {
      scoreMap[b.userId] = { userName: b.userName, score: 0 };
    }
    if (b.result === "correct") {
      scoreMap[b.userId].score += 1;
    }
  }
  const scores = Object.entries(scoreMap)
    .map(([userId, { userName, score }]) => ({ userId, userName, score }))
    .sort((a, b) => b.score - a.score);

  const advanceBtnLabel =
    phase === "waiting"
      ? "開始第一題"
      : phase === "open"
      ? "關閉搶答"
      : "下一題";

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2
        data-testid="fb-title"
        className="text-xl font-bold text-center"
      >
        {config.title || DEFAULT_CONFIG.title}
      </h2>
      <p
        data-testid="fb-phase"
        className="text-center text-sm text-violet-600 font-medium"
      >
        {PHASE_LABELS[phase] ?? phase}
      </p>
      <p className="text-xs text-center text-gray-400">
        共 {questions.length} 題
      </p>

      {(phase === "open" || phase === "judging") && currentQ && (
        <p
          data-testid="fb-question"
          className="text-base font-medium text-center p-4 bg-violet-50 rounded-xl"
        >
          {currentQ}
        </p>
      )}

      {phase === "open" && (
        <div className="text-center space-y-3">
          <button
            data-testid="fb-buzz-btn"
            onClick={onBuzz}
            disabled={!!myBuzzedThisQ}
            className="w-full py-6 text-3xl bg-red-500 text-white rounded-2xl font-bold shadow-lg disabled:opacity-40 hover:bg-red-600 disabled:cursor-not-allowed active:scale-95 transition-transform"
          >
            🔔 搶答！
          </button>
          {myBuzzedThisQ && (
            <p className="text-sm text-gray-500">✅ 已按鈴，等待判定</p>
          )}
          {sortedBuzzes.length > 0 && (
            <p className="text-xs text-gray-400">
              已有 {sortedBuzzes.length} 人搶答
            </p>
          )}
        </div>
      )}

      {phase === "judging" && (
        <div className="space-y-3">
          {firstBuzz ? (
            <div
              data-testid="fb-first-buzz"
              className="p-4 bg-yellow-50 border-2 border-yellow-400 rounded-xl text-center"
            >
              <p className="text-xs text-yellow-600 mb-1">🏆 最快搶答</p>
              <p className="text-xl font-bold text-yellow-800">
                {firstBuzz.userName}
              </p>
              <div className="flex gap-2 mt-3 justify-center">
                <button
                  data-testid="fb-correct-btn"
                  onClick={() => onJudge(firstBuzz.buzzId, true)}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600"
                >
                  ✅ 答對
                </button>
                <button
                  data-testid="fb-wrong-btn"
                  onClick={() => onJudge(firstBuzz.buzzId, false)}
                  className="px-6 py-2 bg-red-400 text-white rounded-lg font-semibold hover:bg-red-500"
                >
                  ❌ 答錯
                </button>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-400 text-sm">尚無人搶答</p>
          )}
        </div>
      )}

      {phase !== "done" && (
        <div className="text-center">
          <button
            data-testid="fb-advance-btn"
            onClick={onAdvance}
            className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"
          >
            {advanceBtnLabel}
          </button>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-3">
          {scores.length === 0 ? (
            <div
              data-testid="fb-empty"
              className="text-center text-gray-400 py-8"
            >
              尚無得分紀錄
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-center text-sm text-gray-500">最終排行榜</p>
              {scores.map((s, rank) => (
                <div
                  key={s.userId}
                  data-testid={`fb-score-${s.userId}`}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    rank === 0
                      ? "border-yellow-400 bg-yellow-50"
                      : s.userId === myUserId
                      ? "border-violet-200 bg-violet-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <span className="text-sm">
                    {rank === 0 && "🏆 "}
                    {s.userName}
                    {s.userId === myUserId && " （我）"}
                  </span>
                  <span className="font-bold text-violet-700">
                    {s.score} 分
                  </span>
                </div>
              ))}
              <p
                data-testid="fb-winner"
                className="text-center text-sm font-semibold text-yellow-700"
              >
                🏆 冠軍：{scores[0].userName}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
