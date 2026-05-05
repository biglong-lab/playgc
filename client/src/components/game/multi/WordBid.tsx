import React from "react";

export interface WordBidConfig extends Record<string, unknown> {
  title: string;
  topic: string;
  prompt: string;
  maxWordLength: number;
  maxVotesPerPerson: number;
}

export interface BidWord extends Record<string, unknown> {
  wordId: string;
  userId: string;
  userName: string;
  word: string;
}

export interface WordBidState extends Record<string, unknown> {
  words: BidWord[];
  votes: { voterId: string; wordId: string }[];
  phase: "submit" | "vote" | "result";
}

interface Props {
  config: WordBidConfig;
  state: WordBidState;
  myUserId: string;
  draftWord: string;
  onDraftChange: (value: string) => void;
  onSubmitWord: () => void;
  onVote: (wordId: string) => void;
  onAdvancePhase: () => void;
}

export default function WordBid({
  config,
  state,
  myUserId,
  draftWord,
  onDraftChange,
  onSubmitWord,
  onVote,
  onAdvancePhase,
}: Props) {
  const { title, topic, prompt, maxWordLength, maxVotesPerPerson } = config;
  const { words, votes, phase } = state;

  const myWord = words.find((w) => w.userId === myUserId);
  const myVotes = votes.filter((v) => v.voterId === myUserId);
  const canVote = myVotes.length < maxVotesPerPerson;
  const isOver = draftWord.length > maxWordLength;
  const canSubmit = draftWord.trim().length > 0 && !isOver && !myWord;

  function voteCountFor(wordId: string) {
    return votes.filter((v) => v.wordId === wordId).length;
  }

  const sortedWords = [...words].sort((a, b) => voteCountFor(b.wordId) - voteCountFor(a.wordId));

  return (
    <div data-testid="wb-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="wb-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <div
        data-testid="wb-topic"
        className="text-center p-3 bg-indigo-50 rounded-xl border border-indigo-200 font-semibold text-indigo-800 text-lg"
      >
        {topic}
      </div>
      <p data-testid="wb-prompt" className="text-sm text-center text-gray-600">
        {prompt}
      </p>

      <div data-testid="wb-phase" className="text-center text-xs font-semibold text-white bg-indigo-500 rounded-full py-1 px-3 self-center">
        {phase === "submit" && "📝 提交階段"}
        {phase === "vote" && "🗳️ 投票階段"}
        {phase === "result" && "🏆 結果揭曉"}
      </div>

      <div data-testid="wb-count" className="text-center text-sm text-gray-500">
        {words.length} 人已提交詞語
      </div>

      {phase === "submit" && (
        <>
          {!myWord ? (
            <div className="flex flex-col gap-2">
              <input
                data-testid="wb-input"
                type="text"
                value={draftWord}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder="輸入你的詞語…"
                maxLength={maxWordLength + 5}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {isOver && (
                <p data-testid="wb-error" className="text-xs text-red-500 text-center">
                  最多 {maxWordLength} 字
                </p>
              )}
              <button
                data-testid="wb-submit-btn"
                onClick={onSubmitWord}
                disabled={!canSubmit}
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                提交詞語
              </button>
            </div>
          ) : (
            <div data-testid="wb-submitted-msg" className="p-3 bg-green-50 rounded-xl border border-green-200 text-center text-green-700 font-semibold">
              ✅ 你提交了「{myWord.word}」
            </div>
          )}
          <button
            data-testid="wb-advance-btn"
            onClick={onAdvancePhase}
            className="w-full py-2 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 text-sm"
          >
            進入投票階段 →
          </button>
        </>
      )}

      {phase === "vote" && (
        <>
          <p className="text-xs text-center text-gray-500">
            每人可投 {maxVotesPerPerson} 票，已投 {myVotes.length} / {maxVotesPerPerson}
          </p>
          <div className="flex flex-col gap-2">
            {words.map((w) => {
              const myVoteThis = myVotes.some((v) => v.wordId === w.wordId);
              const isOwn = w.userId === myUserId;
              const count = voteCountFor(w.wordId);
              return (
                <div
                  key={w.wordId}
                  data-testid={`wb-word-${w.wordId}`}
                  className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm"
                >
                  <span className="font-semibold text-gray-800">{w.word}</span>
                  <div className="flex items-center gap-2">
                    {count > 0 && (
                      <span data-testid={`wb-vote-count-${w.wordId}`} className="text-sm text-indigo-600 font-bold">
                        {count} 票
                      </span>
                    )}
                    <button
                      data-testid={`wb-vote-btn-${w.wordId}`}
                      onClick={() => onVote(w.wordId)}
                      disabled={isOwn || (!canVote && !myVoteThis)}
                      className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                        myVoteThis
                          ? "bg-indigo-600 text-white"
                          : isOwn
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : canVote
                              ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {myVoteThis ? "✓ 已投" : isOwn ? "自己" : "投票"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            data-testid="wb-advance-btn"
            onClick={onAdvancePhase}
            className="w-full py-2 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 text-sm"
          >
            揭曉結果 →
          </button>
        </>
      )}

      {phase === "result" && (
        <div data-testid="wb-result" className="flex flex-col gap-2">
          {sortedWords.length === 0 ? (
            <div data-testid="wb-empty" className="text-center text-gray-400 p-8">
              沒有人提交詞語
            </div>
          ) : (
            sortedWords.map((w, rank) => {
              const count = voteCountFor(w.wordId);
              const isWinner = rank === 0 && count > 0;
              return (
                <div
                  key={w.wordId}
                  data-testid={`wb-result-word-${w.wordId}`}
                  className={`flex items-center justify-between p-3 rounded-xl border shadow-sm ${
                    isWinner
                      ? "bg-yellow-50 border-yellow-300"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isWinner && <span>🏆</span>}
                    <span className="font-bold text-gray-800">{w.word}</span>
                    <span className="text-xs text-gray-400">— {w.userName}</span>
                  </div>
                  <span data-testid={`wb-result-count-${w.wordId}`} className="text-sm font-bold text-indigo-600">
                    {count} 票
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
