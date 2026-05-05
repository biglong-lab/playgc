import React from "react";

export interface MostLikelyConfig {
  title: string;
  questions: string[];
  showResults: boolean;
}

export interface MostLikelyParticipant {
  userId: string;
  userName: string;
}

export interface MostLikelyVote {
  voterId: string;
  questionIndex: number;
  nomineeId: string;
  nomineeName: string;
}

export interface MostLikelyState extends Record<string, unknown> {
  participants: MostLikelyParticipant[];
  votes: MostLikelyVote[];
  currentQuestionIndex: number;
  revealed: boolean;
}

interface Props {
  config: MostLikelyConfig;
  state: MostLikelyState;
  myUserId: string;
  onJoin: () => void;
  onNominate: (nomineeId: string) => void;
  onReveal: () => void;
  onNext: () => void;
}

export default function MostLikely({
  config,
  state,
  myUserId,
  onJoin,
  onNominate,
  onReveal,
  onNext,
}: Props) {
  const { title, questions, showResults } = config;
  const { participants, votes, currentQuestionIndex, revealed } = state;

  const isDone = currentQuestionIndex >= questions.length;
  const currentQ = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex >= questions.length - 1;
  const isJoined = participants.some((p) => p.userId === myUserId);

  const currentVotes = votes.filter((v) => v.questionIndex === currentQuestionIndex);
  const myCurrentVote = currentVotes.find((v) => v.voterId === myUserId);

  const nomineeCount: Record<string, number> = {};
  const nomineeNames: Record<string, string> = {};
  currentVotes.forEach((v) => {
    nomineeCount[v.nomineeId] = (nomineeCount[v.nomineeId] ?? 0) + 1;
    nomineeNames[v.nomineeId] = v.nomineeName;
  });
  const maxCount = Math.max(...Object.values(nomineeCount), 0);
  const topNominees = Object.entries(nomineeCount)
    .filter(([, cnt]) => cnt === maxCount && maxCount > 0)
    .map(([id]) => nomineeNames[id]);

  if (isDone) {
    return (
      <div data-testid="ml-done" className="flex flex-col gap-4 p-4 max-w-lg mx-auto text-center">
        <h2 data-testid="ml-title" className="text-xl font-bold">{title}</h2>
        <div className="py-6 text-5xl">🏆</div>
        <p className="text-sm text-gray-500">所有題目完成！</p>
      </div>
    );
  }

  return (
    <div data-testid="ml-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <div className="flex justify-between items-center">
        <h2 data-testid="ml-title" className="text-lg font-bold">{title}</h2>
        <span data-testid="ml-progress" className="text-xs text-gray-400">
          {currentQuestionIndex + 1} / {questions.length}
        </span>
      </div>

      <div data-testid="ml-question" className="rounded-xl bg-purple-50 border border-purple-200 p-4 text-center">
        <p className="font-semibold text-purple-800">{currentQ}</p>
      </div>

      {!isJoined && (
        <button
          data-testid="ml-join-btn"
          onClick={onJoin}
          className="w-full py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-semibold transition-colors"
        >
          加入投票
        </button>
      )}

      {isJoined && !myCurrentVote && !revealed && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 text-center">選出你認為最符合的人</p>
          {participants
            .filter((p) => p.userId !== myUserId)
            .map((p) => (
              <button
                key={p.userId}
                data-testid={`ml-nominee-${p.userId}`}
                onClick={() => onNominate(p.userId)}
                className="w-full p-3 rounded-xl border-2 border-gray-200 bg-white hover:border-purple-400 hover:bg-purple-50 text-left text-sm font-medium transition-all"
              >
                {p.userName}
              </button>
            ))}
        </div>
      )}

      {myCurrentVote && !revealed && (
        <p data-testid="ml-voted-msg" className="text-center text-green-600 font-semibold text-sm">
          ✅ 已投票（{currentVotes.length} 人已投）
        </p>
      )}

      {revealed && showResults && (
        <div data-testid="ml-results" className="flex flex-col gap-2">
          {Object.entries(nomineeCount)
            .sort(([, a], [, b]) => b - a)
            .map(([nomineeId, count]) => {
              const pct = currentVotes.length > 0
                ? Math.round((count / currentVotes.length) * 100)
                : 0;
              return (
                <div
                  key={nomineeId}
                  data-testid={`ml-result-${nomineeId}`}
                  className={[
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                    count === maxCount
                      ? "border-purple-400 bg-purple-50 font-bold"
                      : "border-gray-200",
                  ].join(" ")}
                >
                  <span data-testid={`ml-nominee-name-${nomineeId}`}>
                    {nomineeNames[nomineeId]}
                  </span>
                  <div className="flex items-center gap-2">
                    <span data-testid={`ml-vote-count-${nomineeId}`} className="text-xs text-gray-500">
                      {count} 票
                    </span>
                    <span data-testid={`ml-vote-pct-${nomineeId}`} className="text-xs font-bold text-purple-600">
                      {pct}%
                    </span>
                    {count === maxCount && (
                      <span data-testid={`ml-top-${nomineeId}`}>👑</span>
                    )}
                  </div>
                </div>
              );
            })}
          {topNominees.length > 0 && (
            <p data-testid="ml-winner" className="text-center text-sm font-semibold text-purple-700 mt-1">
              最有可能的是：{topNominees.join("、")}！
            </p>
          )}
        </div>
      )}

      {isJoined && !revealed && (
        <button
          data-testid="ml-reveal-btn"
          onClick={onReveal}
          className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
        >
          揭曉結果
        </button>
      )}

      {revealed && (
        <button
          data-testid="ml-next-btn"
          onClick={onNext}
          className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors"
        >
          {isLastQuestion ? "結束" : "下一題"}
        </button>
      )}

      <div className="text-xs text-gray-400 text-center">
        <span data-testid="ml-participant-count">{participants.length}</span> 人已加入
      </div>
    </div>
  );
}
