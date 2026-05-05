import React from "react";

export interface WordAssociationConfig {
  title: string;
  words: string[];
  maxResponseLength: number;
  showAuthor: boolean;
}

export interface AssocResponse {
  responseId: string;
  userId: string;
  userName: string;
  wordIndex: number;
  response: string;
}

export interface WordAssociationState extends Record<string, unknown> {
  responses: AssocResponse[];
  currentWordIndex: number;
  revealedUpTo: number;
}

interface Props {
  config: WordAssociationConfig;
  state: WordAssociationState;
  myUserId: string;
  draftResponse: string;
  onDraftChange: (text: string) => void;
  onSubmitResponse: () => void;
  onReveal: () => void;
  onNext: () => void;
}

export default function WordAssociation({
  config,
  state,
  myUserId,
  draftResponse,
  onDraftChange,
  onSubmitResponse,
  onReveal,
  onNext,
}: Props) {
  const { title, words, maxResponseLength, showAuthor } = config;
  const { responses, currentWordIndex, revealedUpTo } = state;

  const allDone = currentWordIndex >= words.length;
  const currentWord = words[currentWordIndex] ?? null;
  const isCurrentRevealed = currentWordIndex < revealedUpTo;
  const isLastWord = currentWordIndex >= words.length - 1;

  const myCurrentResponse = currentWord
    ? responses.find((r) => r.userId === myUserId && r.wordIndex === currentWordIndex)
    : null;

  const currentRevealedResponses = responses.filter((r) => r.wordIndex === currentWordIndex);

  // Group identical responses for visualization
  const responseCounts = currentRevealedResponses.reduce<Record<string, number>>((acc, r) => {
    const key = r.response.trim().toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const totalSubmitted = responses.filter((r) => r.wordIndex === currentWordIndex).length;

  return (
    <div data-testid="wa-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="wa-title" className="text-lg font-bold text-center">{title}</h2>

      {!allDone && currentWord && (
        <>
          {/* 進度 */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span data-testid="wa-progress">第 {currentWordIndex + 1} / {words.length} 詞</span>
            <span>{totalSubmitted} 人已回應</span>
          </div>

          {/* 關鍵詞 */}
          <div className="rounded-2xl bg-purple-50 border-2 border-purple-200 p-6 text-center">
            <p className="text-xs text-purple-400 uppercase font-semibold mb-1">看到這個詞，你第一個想到什麼？</p>
            <p data-testid="wa-word" className="text-3xl font-black text-purple-700">
              {currentWord}
            </p>
          </div>

          {/* 輸入（未作答且未揭曉） */}
          {!myCurrentResponse && !isCurrentRevealed && (
            <div className="flex gap-2">
              <input
                data-testid="wa-input"
                type="text"
                value={draftResponse}
                onChange={(e) => onDraftChange(e.target.value)}
                maxLength={maxResponseLength}
                placeholder="第一個閃過的詞…"
                className="flex-1 px-3 py-2 text-sm rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
              />
              <button
                data-testid="wa-submit-btn"
                onClick={onSubmitResponse}
                disabled={!draftResponse.trim()}
                className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
              >
                送出
              </button>
            </div>
          )}

          {/* 已回應提示 */}
          {myCurrentResponse && !isCurrentRevealed && (
            <p data-testid="wa-responded-msg" className="text-center text-sm font-semibold text-green-600">
              ✅ 已回應「{myCurrentResponse.response}」，等待揭曉
            </p>
          )}

          {/* 揭曉按鈕 */}
          {!isCurrentRevealed && (
            <button
              data-testid="wa-reveal-btn"
              onClick={onReveal}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors self-center"
            >
              揭曉大家的聯想
            </button>
          )}

          {/* 揭曉結果 */}
          {isCurrentRevealed && (
            <div data-testid="wa-result" className="flex flex-col gap-3">
              <p className="text-center text-purple-600 text-sm font-semibold">
                💭 {currentRevealedResponses.length} 則聯想
              </p>

              {/* 相同回應分組展示 */}
              {Object.entries(responseCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([word, count]) => (
                  <div
                    key={word}
                    data-testid={`wa-response-group-${word}`}
                    className="flex items-center gap-2 rounded-xl bg-purple-50 border border-purple-100 px-3 py-2"
                  >
                    <span className="flex-1 text-sm font-semibold text-purple-700">{word}</span>
                    {count > 1 && (
                      <span data-testid={`wa-response-count-${word}`} className="text-xs bg-purple-200 text-purple-700 rounded-full px-2 py-0.5 font-bold">
                        ×{count}
                      </span>
                    )}
                  </div>
                ))}

              {/* 個人回應（showAuthor） */}
              {showAuthor && (
                <div className="flex flex-col gap-1 mt-1">
                  {currentRevealedResponses.map((r) => (
                    <p key={r.responseId} data-testid={`wa-author-response-${r.responseId}`} className="text-xs text-gray-400">
                      <span className="font-semibold">{r.userName}</span>：{r.response}
                    </p>
                  ))}
                </div>
              )}

              {/* 下一詞 / 結束 */}
              {!isLastWord && (
                <button
                  data-testid="wa-next-btn"
                  onClick={onNext}
                  className="px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors self-center"
                >
                  下一個詞
                </button>
              )}
              {isLastWord && (
                <button
                  data-testid="wa-finish-btn"
                  onClick={onNext}
                  className="px-4 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors self-center"
                >
                  完成所有詞！
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* 全部完成 */}
      {allDone && (
        <div data-testid="wa-complete" className="text-center py-6">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-purple-600 font-semibold">所有詞語完成！</p>
          <p className="text-sm text-gray-400 mt-1">共探索了 {words.length} 個詞，收集 {responses.length} 則聯想</p>
        </div>
      )}
    </div>
  );
}
