import React from "react";

export interface BottleLetterConfig {
  title: string;
  prompt: string;
  maxLength: number;
  showAuthor: boolean;
}

export interface Letter {
  letterId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface BottleLetterState extends Record<string, unknown> {
  letters: Letter[];
  revealed: boolean;
}

interface Props {
  config: BottleLetterConfig;
  state: BottleLetterState;
  myUserId: string;
  draftText: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

function shuffleLetters(letters: Letter[]): Letter[] {
  // deterministic shuffle based on letterId hash for stable display
  return [...letters].sort((a, b) => {
    const ha = a.letterId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hb = b.letterId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return (ha * 31) % 97 - (hb * 31) % 97;
  });
}

export default function BottleLetter({
  config,
  state,
  myUserId,
  draftText,
  onDraftChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, prompt, maxLength, showAuthor } = config;
  const { letters, revealed } = state;

  const myLetter = letters.find((l) => l.userId === myUserId);
  const hasSubmitted = !!myLetter;
  const canSubmit = draftText.trim().length > 0;

  const shuffled = revealed ? shuffleLetters(letters) : [];

  return (
    <div data-testid="bl-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <div className="text-center">
        <div className="text-4xl mb-1">🍾</div>
        <h2 data-testid="bl-title" className="text-lg font-bold">{title}</h2>
        <p data-testid="bl-prompt" className="text-sm text-gray-500 mt-1">{prompt}</p>
      </div>

      {/* 輸入區 */}
      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-blue-200 bg-blue-100">
              <p className="text-xs text-blue-600 font-medium">✍️ 寫下你的漂流瓶信件</p>
            </div>
            <textarea
              data-testid="bl-input"
              value={draftText}
              onChange={(e) => onDraftChange(e.target.value)}
              maxLength={maxLength}
              rows={4}
              placeholder="寫下你想說的話，等漂流到陌生人手中…"
              className="w-full px-3 py-2 text-sm resize-none focus:outline-none bg-transparent"
            />
            <div className="px-3 py-1 text-xs text-gray-400 text-right">
              {draftText.length}/{maxLength}
            </div>
          </div>

          <button
            data-testid="bl-submit-btn"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors self-end"
          >
            投入大海 🌊
          </button>
        </div>
      )}

      {/* 已送出 */}
      {hasSubmitted && !revealed && (
        <div data-testid="bl-submitted-msg" className="rounded-xl bg-teal-50 border border-teal-200 p-4 text-center">
          <p className="text-2xl mb-2">🌊</p>
          <p className="text-sm font-semibold text-teal-700">信件已投入大海！</p>
          <p className="text-xs text-teal-500 mt-1">等待所有人完成後一起開啟漂流瓶</p>
        </div>
      )}

      {/* 揭曉控制 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="bl-count">{letters.length}</span> 封信已投入
          </p>
          <button
            data-testid="bl-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            打撈所有漂流瓶
          </button>
        </div>
      )}

      {/* 揭曉後：隨機排列信件 */}
      {revealed && (
        <div data-testid="bl-result" className="flex flex-col gap-3">
          <p className="text-center text-blue-600 text-sm font-semibold">
            🍾 打撈到 {letters.length} 封漂流瓶
          </p>

          {letters.length === 0 ? (
            <p data-testid="bl-empty" className="text-center text-gray-400 text-sm py-4">
              海裡沒有任何信件
            </p>
          ) : (
            shuffled.map((letter, idx) => (
              <div
                key={letter.letterId}
                data-testid={`bl-letter-${letter.letterId}`}
                className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-teal-50 p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🍾</span>
                  <span className="text-xs text-blue-400 font-medium">漂流瓶 #{idx + 1}</span>
                  {showAuthor && (
                    <span data-testid={`bl-author-${letter.letterId}`} className="text-xs text-gray-400 ml-auto">
                      — {letter.userName}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 italic leading-relaxed">{letter.text}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
