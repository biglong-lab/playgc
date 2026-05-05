import { useState } from "react";

export interface QuizQuestion extends Record<string, unknown> {
  questionId: string;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface QuizAnswer extends Record<string, unknown> {
  userId: string;
  userName: string;
  questionId: string;
  answerIndex: number;
  answeredAt: number;
}

export interface QuizBlitzConfig extends Record<string, unknown> {
  title: string;
  questions: QuizQuestion[];
  showLeaderboard: boolean;
}

export interface QuizBlitzState extends Record<string, unknown> {
  currentQuestionIndex: number;
  answers: QuizAnswer[];
  phase: "waiting" | "question" | "reveal" | "done";
}

const OPTION_LABELS = ["A", "B", "C", "D"];

const DEFAULT_CONFIG: QuizBlitzConfig = {
  title: "快問快答",
  questions: [],
  showLeaderboard: true,
};

interface Props {
  config: QuizBlitzConfig;
  state: QuizBlitzState;
  myUserId: string;
  onAnswer: (questionId: string, answerIndex: number) => void;
  onAdvance: () => void;
}

export default function QuizBlitz({
  config,
  state,
  myUserId,
  onAnswer,
  onAdvance,
}: Props) {
  const questions = config.questions ?? DEFAULT_CONFIG.questions;
  const { currentQuestionIndex, answers, phase } = state;

  const currentQuestion =
    currentQuestionIndex >= 0 && currentQuestionIndex < questions.length
      ? questions[currentQuestionIndex]
      : null;

  const myAnswer = currentQuestion
    ? answers.find(
        (a) =>
          a.userId === myUserId && a.questionId === currentQuestion.questionId
      )
    : undefined;

  const scoreMap: Record<string, { userName: string; score: number }> = {};
  for (const ans of answers) {
    const q = questions.find((q) => q.questionId === ans.questionId);
    if (!q) continue;
    if (!scoreMap[ans.userId]) {
      scoreMap[ans.userId] = { userName: ans.userName, score: 0 };
    }
    if (ans.answerIndex === q.correctIndex) {
      scoreMap[ans.userId].score += 1;
    }
  }
  const scores = Object.entries(scoreMap)
    .map(([userId, { userName, score }]) => ({ userId, userName, score }))
    .sort((a, b) => b.score - a.score);

  const phaseLabel =
    phase === "waiting"
      ? "等待開始"
      : phase === "question"
      ? `第 ${currentQuestionIndex + 1} 題`
      : phase === "reveal"
      ? `揭曉第 ${currentQuestionIndex + 1} 題`
      : "結束";

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2
        data-testid="qb-title"
        className="text-xl font-bold text-center"
      >
        {config.title || DEFAULT_CONFIG.title}
      </h2>
      <p
        data-testid="qb-phase"
        className="text-center text-sm text-violet-600 font-medium"
      >
        {phaseLabel}
      </p>
      <p
        data-testid="qb-question-count"
        className="text-xs text-center text-gray-400"
      >
        共 {questions.length} 題
      </p>

      {phase === "waiting" && (
        <div className="text-center space-y-4 py-6">
          <p className="text-gray-500 text-sm">等待主持人開始測驗…</p>
          <button
            data-testid="qb-advance-btn"
            onClick={onAdvance}
            className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"
          >
            開始測驗
          </button>
        </div>
      )}

      {phase === "question" && currentQuestion && (
        <div className="space-y-3">
          <p
            data-testid="qb-question-text"
            className="text-base font-medium text-center p-3 bg-violet-50 rounded-lg"
          >
            {currentQuestion.text}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = myAnswer?.answerIndex === idx;
              return (
                <button
                  key={idx}
                  data-testid={`qb-option-${idx}`}
                  onClick={() => onAnswer(currentQuestion.questionId, idx)}
                  disabled={!!myAnswer}
                  className={`p-3 rounded-lg text-sm border-2 transition-colors text-left ${
                    isSelected
                      ? "border-violet-500 bg-violet-100 text-violet-800"
                      : "border-gray-200 bg-white hover:border-violet-300 disabled:opacity-60"
                  }`}
                >
                  <span className="font-bold mr-2">{OPTION_LABELS[idx]}.</span>
                  {opt}
                </button>
              );
            })}
          </div>
          {myAnswer && (
            <p className="text-center text-sm text-green-600">
              ✅ 已作答，等待揭曉
            </p>
          )}
          <div className="text-center">
            <button
              data-testid="qb-advance-btn"
              onClick={onAdvance}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"
            >
              揭曉答案
            </button>
          </div>
        </div>
      )}

      {phase === "reveal" && currentQuestion && (
        <div className="space-y-3">
          <p
            data-testid="qb-question-text"
            className="text-base font-medium text-center p-3 bg-violet-50 rounded-lg"
          >
            {currentQuestion.text}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {currentQuestion.options.map((opt, idx) => {
              const isCorrect = idx === currentQuestion.correctIndex;
              const myPick = myAnswer?.answerIndex === idx;
              return (
                <div
                  key={idx}
                  data-testid={`qb-option-${idx}`}
                  className={`p-3 rounded-lg text-sm border-2 ${
                    isCorrect
                      ? "border-green-500 bg-green-100 text-green-800"
                      : myPick
                      ? "border-red-400 bg-red-50 text-red-700"
                      : "border-gray-200 bg-white text-gray-500"
                  }`}
                >
                  <span className="font-bold mr-2">{OPTION_LABELS[idx]}.</span>
                  {opt}
                  {isCorrect && " ✅"}
                </div>
              );
            })}
          </div>
          {myAnswer?.answerIndex === currentQuestion.correctIndex && (
            <p
              data-testid="qb-correct-badge"
              className="text-center text-green-600 font-semibold"
            >
              🎉 答對了！
            </p>
          )}
          <div className="text-center">
            <button
              data-testid="qb-advance-btn"
              onClick={onAdvance}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"
            >
              {currentQuestionIndex + 1 < questions.length
                ? "下一題"
                : "查看排行榜"}
            </button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-3">
          {scores.length === 0 ? (
            <div
              data-testid="qb-empty"
              className="text-center text-gray-400 py-8"
            >
              尚無作答紀錄
            </div>
          ) : (
            <div data-testid="qb-leaderboard" className="space-y-2">
              <p className="text-center text-sm text-gray-500">最終排行榜</p>
              {scores.map((s, rank) => (
                <div
                  key={s.userId}
                  data-testid={`qb-score-${s.userId}`}
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
                    {s.score} / {questions.length}
                  </span>
                </div>
              ))}
              <p
                data-testid="qb-winner"
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
