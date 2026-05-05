import React from "react";

export interface LetterToSelfConfig {
  title: string;
  prompt: string;
  maxLength: number;
  showAuthor: boolean;
}

export interface SelfLetter {
  letterId: string;
  userId: string;
  userName: string;
  content: string;
}

export interface LetterToSelfState extends Record<string, unknown> {
  letters: SelfLetter[];
  revealed: boolean;
}

interface Props {
  config: LetterToSelfConfig;
  state: LetterToSelfState;
  myUserId: string;
  draftText: string;
  onDraftChange: (text: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

export default function LetterToSelf({
  config,
  state,
  myUserId,
  draftText,
  onDraftChange,
  onReveal,
  onSubmit,
}: Props) {
  const { title, prompt, maxLength, showAuthor } = config;
  const { letters, revealed } = state;

  const myLetter = letters.find((l) => l.userId === myUserId);
  const hasSubmitted = !!myLetter;
  const charsLeft = maxLength - draftText.length;

  return (
    <div data-testid="lts-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="lts-title" className="text-lg font-bold text-center">{title}</h2>

      <div data-testid="lts-prompt" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
        <p className="font-semibold text-amber-800 text-sm">{prompt}</p>
      </div>

      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-2">
          <textarea
            data-testid="lts-input"
            value={draftText}
            onChange={(e) => onDraftChange(e.target.value)}
            maxLength={maxLength}
            rows={5}
            placeholder="寫下你想說的話…"
            className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm resize-none focus:border-amber-400 focus:outline-none"
          />
          <div className="flex justify-between items-center">
            <span data-testid="lts-chars-left" className="text-xs text-gray-400">
              還可輸入 {charsLeft} 字
            </span>
            <button
              data-testid="lts-submit-btn"
              onClick={onSubmit}
              disabled={draftText.trim().length === 0}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              寄出信件
            </button>
          </div>
        </div>
      )}

      {hasSubmitted && !revealed && (
        <div className="flex flex-col gap-3">
          <p data-testid="lts-submitted-msg" className="text-center text-green-600 font-semibold text-sm">
            ✅ 已寄出，等待揭曉
          </p>
          <div data-testid="lts-my-preview" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-gray-600 italic">
            「{myLetter!.content.slice(0, 30)}{myLetter!.content.length > 30 ? "…" : ""}」
          </div>
        </div>
      )}

      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="lts-count">{letters.length}</span> 封信已寄出
          </p>
          <button
            data-testid="lts-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors"
          >
            揭曉所有信件
          </button>
        </div>
      )}

      {revealed && (
        <div data-testid="lts-revealed-section" className="flex flex-col gap-3">
          <p className="text-center text-purple-600 font-semibold text-sm">
            ✉️ 信件時光機開啟！共 {letters.length} 封信
          </p>
          {letters.length === 0 ? (
            <p data-testid="lts-empty" className="text-center text-gray-400 text-sm py-4">還沒有人寄信</p>
          ) : (
            <div data-testid="lts-letters" className="flex flex-col gap-3">
              {letters.map((letter, idx) => (
                <div
                  key={letter.letterId}
                  data-testid={`lts-letter-${letter.letterId}`}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"
                >
                  {showAuthor && (
                    <p
                      data-testid={`lts-author-${letter.letterId}`}
                      className="text-xs font-semibold text-amber-700 mb-1"
                    >
                      {letter.userName}
                    </p>
                  )}
                  <p
                    data-testid={`lts-content-${letter.letterId}`}
                    className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
                  >
                    {letter.content}
                  </p>
                  <p className="text-xs text-gray-400 mt-2 text-right">#{idx + 1}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
