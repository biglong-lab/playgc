// 📺 TriviaShowdown — 搶答秀元件（Phase 2 W5 D3，M 級、園遊會主舞台）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// pageType: host_trivia_showdown
//
// 玩法：
//   - admin 設多題（題目+選項+正確答案+秒數）
//   - 大螢幕：題目大字 + 倒數 + Top 3 即時排名
//   - 玩家：A/B/C/D 大按鈕搶答
//   - 計分：第 1 答對 100 / 第 2 75 / 第 3 50 / 之後 25（超時不得分）
//   - admin 端送 pulse: 'next_question' / 'reveal_answer' / 'reset'
//
// state 結構：
//   {
//     currentQuestionIdx: number;
//     status: "intro" | "question" | "answering" | "revealed" | "ended";
//     answered: Record<userName, { choice, ts }>;  // 本題已答的人
//     scores: Record<userName, number>;            // 累計分
//     questionStartedAt?: number;
//   }

import { useState, useEffect, useMemo, useCallback } from "react";

interface TriviaQuestion {
  id: string;
  prompt: string;
  options: string[];     // 4 個
  correctIdx: number;    // 0-3
  timeLimitSec?: number; // 預設 15
}

export interface TriviaShowdownConfig {
  title?: string;
  subtitle?: string;
  questions?: TriviaQuestion[];
  /** 第 N 答對的得分 */
  scoreByRank?: number[]; // 預設 [100, 75, 50, 25]
}

interface AnswerRecord {
  choice: number;
  ts: number;
}

interface TriviaShowdownState {
  currentQuestionIdx: number;
  status: "intro" | "question" | "answering" | "revealed" | "ended";
  answered: Record<string, AnswerRecord>;
  scores: Record<string, number>;
  questionStartedAt?: number;
}

export interface TriviaShowdownProps {
  config: TriviaShowdownConfig;
  hostMode: boolean;
  state?: TriviaShowdownState | null;
  myUserName?: string;
  /** 🆕 Phase 4 (2026-05-08)：server-side scoring 用、玩家答題直接 POST */
  sessionId?: string;
  myUserId?: string;
  onPulse?: (pulseType: string, payload: unknown) => void;
  onBroadcastState?: (state: TriviaShowdownState) => void;
}

const OPTION_LETTERS = ["A", "B", "C", "D"];
const OPTION_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#eab308"];

function buildInitialState(): TriviaShowdownState {
  return {
    currentQuestionIdx: 0,
    status: "intro",
    answered: {},
    scores: {},
  };
}

export default function TriviaShowdown({ config, hostMode, state, myUserName, sessionId, myUserId, onPulse, onBroadcastState }: TriviaShowdownProps) {
  const questions = config.questions ?? [];
  const effectiveState = state ?? buildInitialState();
  const currentQ = questions[effectiveState.currentQuestionIdx];
  const timeLimitSec = currentQ?.timeLimitSec ?? 15;

  // 倒數
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!hostMode || effectiveState.status !== "answering") return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [hostMode, effectiveState.status]);

  const remaining = useMemo(() => {
    if (effectiveState.status !== "answering" || !effectiveState.questionStartedAt) return null;
    const elapsed = (now - effectiveState.questionStartedAt) / 1000;
    return Math.max(0, Math.ceil(timeLimitSec - elapsed));
  }, [effectiveState.status, effectiveState.questionStartedAt, now, timeLimitSec]);

  const myAnswer = myUserName ? effectiveState.answered[myUserName] : undefined;

  const handleAnswer = useCallback(async (choice: number) => {
    if (effectiveState.status !== "answering" || myAnswer) return;
    // 🆕 Phase 4 (2026-05-08)：server-side scoring
    // 玩家答題直接 POST 給 server、server 寫 DB + 算 rank/score + broadcast 新 state
    // ADR-0018 規則 4：計分必須 server-side source-of-truth
    if (sessionId && myUserId && myUserName && currentQ) {
      try {
        await fetch(`/api/trivia/${sessionId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            questionId: currentQ.id,
            choice,
            correctIdx: currentQ.correctIdx,
            scoreByRank: config.scoreByRank,
            userId: myUserId,
            userName: myUserName,
          }),
        });
      } catch (err) {
        console.error("[TriviaShowdown] POST answer failed:", err);
      }
    } else {
      // Fallback：缺 sessionId/userId 時走原 ws pulse（測試環境 / dev）
      onPulse?.("answer", { choice, ts: Date.now() });
    }
  }, [effectiveState.status, myAnswer, onPulse, sessionId, myUserId, myUserName, currentQ, config.scoreByRank]);

  // 大螢幕主控按鈕（host 才用）
  const handleStart = useCallback(() => {
    onBroadcastState?.({
      ...effectiveState,
      status: "answering",
      questionStartedAt: Date.now(),
      answered: {},
    });
  }, [effectiveState, onBroadcastState]);

  const handleReveal = useCallback(() => {
    onBroadcastState?.({ ...effectiveState, status: "revealed" });
  }, [effectiveState, onBroadcastState]);

  const handleNext = useCallback(() => {
    const nextIdx = effectiveState.currentQuestionIdx + 1;
    if (nextIdx >= questions.length) {
      onBroadcastState?.({ ...effectiveState, status: "ended" });
    } else {
      onBroadcastState?.({
        ...effectiveState,
        currentQuestionIdx: nextIdx,
        status: "intro",
        answered: {},
        questionStartedAt: undefined,
      });
    }
  }, [effectiveState, questions.length, onBroadcastState]);

  // ─── 大螢幕版型 ───
  if (hostMode) {
    // 結算
    if (effectiveState.status === "ended") {
      const sorted = Object.entries(effectiveState.scores).sort((a, b) => b[1] - a[1]);
      return (
        <div className="w-full h-full min-h-screen bg-gradient-to-b from-purple-900 to-black text-white p-8 flex flex-col items-center justify-center">
          <div className="text-7xl mb-4">🏆</div>
          <h1 className="text-4xl md:text-6xl font-bold mb-8">最終結果</h1>
          <div className="space-y-3 max-w-2xl w-full">
            {sorted.slice(0, 10).map(([name, score], i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
              return (
                <div
                  key={name}
                  className={`flex items-center gap-4 px-5 py-3 rounded-lg ${
                    i === 0 ? "bg-yellow-500/20 border border-yellow-500/40" : "bg-zinc-800/50 border border-zinc-700"
                  }`}
                >
                  <div className="text-3xl w-12 text-center">{medal}</div>
                  <div className="flex-1 text-xl font-medium">{name}</div>
                  <div className="text-2xl font-bold font-mono text-primary">{score}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (!currentQ) {
      return (
        <div className="w-full h-full min-h-screen bg-zinc-900 text-white flex items-center justify-center p-8">
          <p className="text-xl text-zinc-400">尚未設定題目</p>
        </div>
      );
    }

    return (
      <div className="w-full h-full min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white p-8 md:p-12">
        <div className="text-center mb-6">
          <p className="text-sm text-zinc-500">
            第 {effectiveState.currentQuestionIdx + 1} / {questions.length} 題
          </p>
          {effectiveState.status === "answering" && remaining !== null && (
            <div className={`text-7xl font-bold ${remaining <= 5 ? "text-red-500 animate-pulse" : "text-emerald-400"}`}>
              {remaining}
            </div>
          )}
        </div>

        <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold text-center mb-12 leading-tight">
          {currentQ.prompt}
        </h1>

        {/* 4 選項 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {currentQ.options.map((opt, idx) => {
            const isCorrect = effectiveState.status === "revealed" && idx === currentQ.correctIdx;
            const isWrong = effectiveState.status === "revealed" && idx !== currentQ.correctIdx;
            return (
              <div
                key={idx}
                className={`px-6 py-5 rounded-xl text-2xl md:text-3xl font-medium flex items-center gap-4 transition-all ${
                  isCorrect
                    ? "bg-emerald-500 text-white scale-105"
                    : isWrong
                      ? "bg-zinc-700 text-zinc-500 opacity-50"
                      : "bg-zinc-800 border border-zinc-700"
                }`}
                style={!isWrong && !isCorrect ? { borderColor: OPTION_COLORS[idx], borderWidth: 2 } : undefined}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 ${
                    isCorrect ? "bg-white text-emerald-700" : "text-white"
                  }`}
                  style={!isCorrect ? { backgroundColor: OPTION_COLORS[idx] } : undefined}
                >
                  {OPTION_LETTERS[idx]}
                </div>
                <div className="flex-1">{opt}</div>
                {isCorrect && <span className="text-3xl">✓</span>}
              </div>
            );
          })}
        </div>

        {/* 主控按鈕 */}
        <div className="flex justify-center gap-3 mt-8">
          {effectiveState.status === "intro" && (
            <button
              type="button"
              onClick={handleStart}
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-bold text-lg"
              data-testid="btn-start-question"
            >
              開始計時
            </button>
          )}
          {effectiveState.status === "answering" && (
            <button
              type="button"
              onClick={handleReveal}
              className="px-6 py-3 rounded-lg bg-yellow-500 text-yellow-900 font-bold text-lg"
              data-testid="btn-reveal"
            >
              揭曉答案
            </button>
          )}
          {effectiveState.status === "revealed" && (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-3 rounded-lg bg-emerald-500 text-white font-bold text-lg"
              data-testid="btn-next-question"
            >
              {effectiveState.currentQuestionIdx + 1 >= questions.length ? "結算" : "下一題"}
            </button>
          )}
        </div>

        {/* 已答人數 */}
        {effectiveState.status === "answering" && (
          <p className="text-center text-sm text-zinc-500 mt-4">
            已答：{Object.keys(effectiveState.answered).length} 人
          </p>
        )}
      </div>
    );
  }

  // ─── 玩家版型 ───
  if (effectiveState.status === "ended") {
    const myScore = myUserName ? effectiveState.scores[myUserName] ?? 0 : 0;
    const sorted = Object.entries(effectiveState.scores).sort((a, b) => b[1] - a[1]);
    const myRank = myUserName ? sorted.findIndex(([n]) => n === myUserName) + 1 : null;
    return (
      <div className="w-full p-4 max-w-md mx-auto space-y-4 text-center py-8">
        <div className="text-6xl">🏆</div>
        <h2 className="text-2xl font-bold">遊戲結束</h2>
        {myUserName && (
          <div className="bg-primary/10 border-2 border-primary rounded-xl p-4">
            <p className="text-sm text-muted-foreground">我的成績</p>
            <p className="text-3xl font-bold text-primary mt-1">{myScore} 分</p>
            {myRank && <p className="text-sm mt-1">排名 #{myRank}</p>}
          </div>
        )}
      </div>
    );
  }

  if (!currentQ) {
    return <div className="p-4 text-center text-muted-foreground">尚未設定題目</div>;
  }

  return (
    <div className="w-full p-4 max-w-md mx-auto space-y-4">
      <p className="text-xs text-center text-muted-foreground">
        第 {effectiveState.currentQuestionIdx + 1} / {questions.length} 題
      </p>

      <h2 className="text-lg font-bold text-center leading-snug">{currentQ.prompt}</h2>

      {effectiveState.status === "intro" && (
        <p className="text-center text-sm text-muted-foreground py-4">
          ⏳ 等待開始...
        </p>
      )}

      {(effectiveState.status === "answering" || effectiveState.status === "revealed") && (
        <div className="grid grid-cols-1 gap-3">
          {currentQ.options.map((opt, idx) => {
            const isMyChoice = myAnswer?.choice === idx;
            const isCorrect = effectiveState.status === "revealed" && idx === currentQ.correctIdx;
            const isWrong = effectiveState.status === "revealed" && idx !== currentQ.correctIdx;
            const canClick = effectiveState.status === "answering" && !myAnswer;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => canClick && handleAnswer(idx)}
                disabled={!canClick}
                className={`p-4 rounded-xl text-left flex items-center gap-3 transition-all ${
                  isCorrect
                    ? "bg-emerald-100 border-2 border-emerald-500 dark:bg-emerald-950/40"
                    : isMyChoice && isWrong
                      ? "bg-red-100 border-2 border-red-500 dark:bg-red-950/40"
                      : isMyChoice
                        ? "bg-primary/10 border-2 border-primary"
                        : canClick
                          ? "bg-card border-2 border-border hover:border-primary/40 active:scale-[0.98]"
                          : "bg-card border-2 border-border opacity-60"
                }`}
                data-testid={`btn-answer-${OPTION_LETTERS[idx]}`}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                  style={{ backgroundColor: OPTION_COLORS[idx] }}
                >
                  {OPTION_LETTERS[idx]}
                </div>
                <span className="flex-1 font-medium">{opt}</span>
                {isCorrect && <span className="text-xl">✓</span>}
                {isMyChoice && isWrong && <span className="text-xl">✗</span>}
              </button>
            );
          })}
        </div>
      )}

      {myAnswer && effectiveState.status === "answering" && (
        <p className="text-center text-sm text-muted-foreground">
          ✅ 已選 {OPTION_LETTERS[myAnswer.choice]}，等待結算
        </p>
      )}
    </div>
  );
}
