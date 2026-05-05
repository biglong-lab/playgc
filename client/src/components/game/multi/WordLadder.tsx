import React from "react";

export interface WordLadderConfig {
  title: string;
  prompt: string;
  startWord: string;
  maxWordLength: number;
}

export interface ChainEntry {
  entryId: string;
  userId: string;
  userName: string;
  word: string;
}

export interface WordLadderState extends Record<string, unknown> {
  chain: ChainEntry[];
  revealed: boolean;
}

interface Props {
  config: WordLadderConfig;
  state: WordLadderState;
  myUserId: string;
  draftWord: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

function getLastChar(word: string): string {
  return word.length > 0 ? word[word.length - 1] : "";
}

function getFirstChar(word: string): string {
  return word.length > 0 ? word[0] : "";
}

export default function WordLadder({
  config,
  state,
  myUserId,
  draftWord,
  onDraftChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, prompt, startWord, maxWordLength } = config;
  const { chain, revealed } = state;

  const myEntry = chain.find((e) => e.userId === myUserId);
  const hasSubmitted = !!myEntry;

  const lastWord = chain.length > 0 ? chain[chain.length - 1].word : startWord;
  const requiredFirstChar = getLastChar(lastWord);

  const isValidWord =
    draftWord.trim().length >= 1 &&
    getFirstChar(draftWord.trim()) === requiredFirstChar;
  const canSubmit = isValidWord && !hasSubmitted;

  const allWords = [startWord, ...chain.map((e) => e.word)];

  return (
    <div data-testid="wl-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="wl-title" className="text-lg font-bold text-center">{title}</h2>
      <p data-testid="wl-prompt" className="text-sm text-gray-500 text-center">{prompt}</p>

      {/* 接龍鏈條 */}
      <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3">
        <p className="text-xs text-indigo-400 mb-2 text-center">接龍鏈條</p>
        <div className="flex flex-wrap items-center gap-1">
          {allWords.map((word, idx) => (
            <React.Fragment key={`${word}-${idx}`}>
              <span
                data-testid={`wl-chain-word-${idx}`}
                className={`px-2 py-1 rounded-lg text-sm font-medium ${
                  idx === 0
                    ? "bg-indigo-200 text-indigo-800"
                    : "bg-white border border-indigo-200 text-gray-700"
                }`}
              >
                {word}
              </span>
              {idx < allWords.length - 1 && (
                <span className="text-indigo-300 text-xs">
                  <span className="text-amber-500 font-bold">{getLastChar(word)}</span>
                  →
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 下一個字要求 */}
      {!revealed && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-center">
          <p className="text-xs text-amber-500">下一個詞必須以</p>
          <p data-testid="wl-required-char" className="text-2xl font-bold text-amber-700">
            「{requiredFirstChar}」
          </p>
          <p className="text-xs text-amber-400">開頭</p>
        </div>
      )}

      {/* 輸入區 */}
      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                data-testid="wl-input"
                type="text"
                value={draftWord}
                onChange={(e) => onDraftChange(e.target.value)}
                maxLength={maxWordLength}
                placeholder={`以「${requiredFirstChar}」開頭的詞…`}
                className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  draftWord.trim().length > 0 && !isValidWord
                    ? "border-red-300 bg-red-50 focus:ring-red-200"
                    : "border-indigo-200 bg-indigo-50 focus:ring-indigo-300"
                }`}
              />
            </div>
            <button
              data-testid="wl-submit-btn"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              接！
            </button>
          </div>
          {draftWord.trim().length > 0 && !isValidWord && (
            <p data-testid="wl-error" className="text-xs text-red-500">
              ⚠️ 必須以「{requiredFirstChar}」開頭
            </p>
          )}
        </div>
      )}

      {/* 已送出 */}
      {hasSubmitted && !revealed && (
        <div data-testid="wl-submitted-msg" className="rounded-xl bg-indigo-50 border border-indigo-200 p-3">
          <p className="text-sm font-semibold text-indigo-700">✅ 接龍成功！</p>
          <p className="text-xs text-indigo-400 mt-1">你貢獻了「{myEntry.word}」，等待更多人接龍</p>
        </div>
      )}

      {/* 揭曉控制 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="wl-count">{chain.length}</span> 人已接龍
          </p>
          <button
            data-testid="wl-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            完成接龍
          </button>
        </div>
      )}

      {/* 揭曉後：完整接龍鏈 */}
      {revealed && (
        <div data-testid="wl-result" className="flex flex-col gap-2">
          <p className="text-center text-indigo-600 text-sm font-semibold">
            🔗 接龍完成！共 {chain.length + 1} 個詞
          </p>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-indigo-200 text-indigo-800 text-sm font-bold">
                {startWord}
              </span>
              {chain.map((entry, idx) => (
                <React.Fragment key={entry.entryId}>
                  <span className="text-xs text-amber-500 font-bold">→</span>
                  <div className="flex flex-col items-center">
                    <span
                      data-testid={`wl-result-word-${idx}`}
                      className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-gray-700 text-sm font-medium"
                    >
                      {entry.word}
                    </span>
                    <span className="text-xs text-gray-400 mt-0.5">{entry.userName}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
