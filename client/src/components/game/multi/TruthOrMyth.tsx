import React from "react";

export interface TruthStatement {
  stmtId: string;
  text: string;
  isTrue: boolean;
}

export interface TruthOrMythConfig {
  title: string;
  statements: TruthStatement[];
}

export interface TruthVote {
  userId: string;
  userName: string;
  stmtId: string;
  answer: "truth" | "myth";
}

export interface TruthOrMythState extends Record<string, unknown> {
  votes: TruthVote[];
  currentIndex: number;
  revealedUpTo: number;
}

interface Props {
  config: TruthOrMythConfig;
  state: TruthOrMythState;
  myUserId: string;
  onVote: (answer: "truth" | "myth") => void;
  onNext: () => void;
  onReveal: () => void;
}

function PlayerScore({ userId, userName, votes, statements }: {
  userId: string;
  userName: string;
  votes: TruthVote[];
  statements: TruthStatement[];
}) {
  const myVotes = votes.filter((v) => v.userId === userId);
  const correct = myVotes.filter((v) => {
    const stmt = statements.find((s) => s.stmtId === v.stmtId);
    if (!stmt) return false;
    return (v.answer === "truth") === stmt.isTrue;
  }).length;
  return (
    <span>
      {userName}: {correct}/{myVotes.length}
    </span>
  );
}

export default function TruthOrMyth({
  config,
  state,
  myUserId,
  onVote,
  onNext,
  onReveal,
}: Props) {
  const { title, statements } = config;
  const { votes, currentIndex, revealedUpTo } = state;

  const currentStmt = statements[currentIndex] ?? null;
  const isLastStatement = currentIndex >= statements.length - 1;
  const allRevealed = currentIndex >= statements.length;

  const myCurrentVote = currentStmt
    ? votes.find((v) => v.userId === myUserId && v.stmtId === currentStmt.stmtId)
    : null;

  const isCurrentRevealed = currentIndex < revealedUpTo;

  // Count votes for current statement
  const truthVoters = currentStmt
    ? votes.filter((v) => v.stmtId === currentStmt.stmtId && v.answer === "truth")
    : [];
  const mythVoters = currentStmt
    ? votes.filter((v) => v.stmtId === currentStmt.stmtId && v.answer === "myth")
    : [];
  const totalVoters = truthVoters.length + mythVoters.length;

  // Unique user scoreboard
  const allUserIds = Array.from(new Set(votes.map((v) => v.userId)));
  const userNames = Object.fromEntries(
    votes.map((v) => [v.userId, v.userName])
  );

  return (
    <div data-testid="tom-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="tom-title" className="text-lg font-bold text-center">{title}</h2>

      {/* 進度 */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span data-testid="tom-progress">
          第 {currentIndex + 1} / {statements.length} 題
        </span>
        <span>{totalVoters} 人已作答</span>
      </div>

      {!allRevealed && currentStmt && (
        <>
          {/* 題目 */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p data-testid="tom-statement" className="text-base font-semibold text-center text-slate-800">
              {currentStmt.text}
            </p>
          </div>

          {/* 投票按鈕（未作答且未揭曉） */}
          {!myCurrentVote && !isCurrentRevealed && (
            <div className="grid grid-cols-2 gap-3">
              <button
                data-testid="tom-vote-truth"
                onClick={() => onVote("truth")}
                className="py-4 rounded-xl bg-green-50 border-2 border-green-200 hover:border-green-400 hover:bg-green-100 text-green-700 font-bold text-lg transition-colors"
              >
                ✅ 真的
              </button>
              <button
                data-testid="tom-vote-myth"
                onClick={() => onVote("myth")}
                className="py-4 rounded-xl bg-red-50 border-2 border-red-200 hover:border-red-400 hover:bg-red-100 text-red-700 font-bold text-lg transition-colors"
              >
                ❌ 假的
              </button>
            </div>
          )}

          {/* 已作答提示 */}
          {myCurrentVote && !isCurrentRevealed && (
            <p data-testid="tom-voted-msg" className="text-center text-sm font-semibold text-green-600">
              ✅ 已選擇「{myCurrentVote.answer === "truth" ? "真的" : "假的"}」，等待揭曉
            </p>
          )}

          {/* 揭曉按鈕（主持人功能） */}
          {!isCurrentRevealed && (
            <button
              data-testid="tom-reveal-btn"
              onClick={onReveal}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors self-center"
            >
              揭曉答案
            </button>
          )}

          {/* 揭曉結果 */}
          {isCurrentRevealed && (
            <div data-testid="tom-result" className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4">
              <p className="text-center font-bold text-indigo-700 mb-2">
                {currentStmt.isTrue ? "✅ 這是真的！" : "❌ 這是假的！"}
              </p>
              <div className="flex gap-4 justify-center text-sm">
                <span className="text-green-600 font-semibold">
                  <span data-testid="tom-truth-count">{truthVoters.length}</span> 票「真的」
                </span>
                <span className="text-red-600 font-semibold">
                  <span data-testid="tom-myth-count">{mythVoters.length}</span> 票「假的」
                </span>
              </div>
            </div>
          )}

          {/* 下一題按鈕 */}
          {isCurrentRevealed && !isLastStatement && (
            <button
              data-testid="tom-next-btn"
              onClick={onNext}
              className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors self-center"
            >
              下一題
            </button>
          )}

          {/* 最後一題揭曉後看分數 */}
          {isCurrentRevealed && isLastStatement && (
            <button
              data-testid="tom-score-btn"
              onClick={onNext}
              className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors self-center"
            >
              查看最終分數
            </button>
          )}
        </>
      )}

      {/* 最終計分板 */}
      {allRevealed && (
        <div data-testid="tom-scoreboard" className="flex flex-col gap-2">
          <p className="text-center text-indigo-600 font-semibold text-sm">🏆 最終得分</p>
          {allUserIds.length === 0 ? (
            <p data-testid="tom-no-players" className="text-center text-gray-400 text-sm">
              還沒有人作答
            </p>
          ) : (
            allUserIds.map((uid) => (
              <div key={uid} data-testid={`tom-score-${uid}`} className="rounded-lg border border-gray-200 px-3 py-2 text-sm flex justify-between">
                <PlayerScore
                  userId={uid}
                  userName={userNames[uid] ?? uid}
                  votes={votes}
                  statements={statements}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
