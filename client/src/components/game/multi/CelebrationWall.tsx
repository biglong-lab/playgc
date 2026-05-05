import React, { useState } from "react";

export interface CelebrationWallConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
  showAuthor: boolean;
}

export interface Celebration extends Record<string, unknown> {
  celId: string;
  userId: string;
  userName: string;
  text: string;
  hearts: string[];
}

export interface CelebrationWallState extends Record<string, unknown> {
  celebrations: Celebration[];
  revealed: boolean;
}

interface Props {
  config: CelebrationWallConfig;
  state: CelebrationWallState;
  myUserId: string;
  onSubmit: (text: string) => void;
  onReveal: () => void;
  onHeart: (celId: string) => void;
}

export default function CelebrationWall({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
  onHeart,
}: Props) {
  const { title, prompt, maxLength, showAuthor } = config;
  const { celebrations, revealed } = state;

  const myCel = celebrations.find((c) => c.userId === myUserId);
  const [text, setText] = useState("");

  const canSubmit = text.trim().length > 0 && text.length <= maxLength && !myCel;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(text.trim());
    setText("");
  }

  return (
    <div data-testid="cw-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="cw-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p data-testid="cw-prompt" className="text-sm text-center text-gray-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
        {prompt}
      </p>

      <div data-testid="cw-count" className="text-center text-sm text-gray-500">
        <span className="font-semibold text-amber-600">{celebrations.length}</span> 個勝利分享
      </div>

      {!myCel && !revealed && (
        <div className="flex flex-col gap-3">
          <textarea
            data-testid="cw-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="分享一件你想慶祝的事…"
            rows={3}
            maxLength={maxLength + 10}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
          />
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span data-testid="cw-char-count">{text.length} / {maxLength}</span>
            {text.length > maxLength && (
              <span data-testid="cw-char-error" className="text-red-500">超出上限</span>
            )}
          </div>

          <button
            data-testid="cw-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🎉 分享我的勝利
          </button>
        </div>
      )}

      {myCel && !revealed && (
        <div data-testid="cw-submitted-msg" className="p-3 bg-green-50 rounded-xl border border-green-200 text-center">
          <p className="text-sm text-gray-700">{myCel.text}</p>
          <p className="text-green-700 font-semibold text-sm mt-2">🎊 已送出！等待揭曉</p>
        </div>
      )}

      {!revealed ? (
        <button
          data-testid="cw-reveal-btn"
          onClick={onReveal}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
        >
          揭曉所有勝利
        </button>
      ) : (
        <div data-testid="cw-result" className="flex flex-col gap-3">
          {celebrations.length === 0 ? (
            <div data-testid="cw-empty" className="text-center text-gray-400 p-8">
              還沒有人分享
            </div>
          ) : (
            celebrations.map((cel) => {
              const hearted = cel.hearts.includes(myUserId);
              return (
                <div
                  key={cel.celId}
                  data-testid={`cw-cel-${cel.celId}`}
                  className="p-4 bg-white rounded-xl border border-amber-100 shadow-sm"
                >
                  {showAuthor && (
                    <p className="text-xs text-amber-500 font-semibold mb-1">{cel.userName}</p>
                  )}
                  <p
                    data-testid={`cw-cel-text-${cel.celId}`}
                    className="text-sm text-gray-700"
                  >
                    🎉 {cel.text}
                  </p>
                  <div className="flex justify-end mt-2">
                    <button
                      data-testid={`cw-heart-${cel.celId}`}
                      onClick={() => onHeart(cel.celId)}
                      className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full ${
                        hearted ? "text-rose-600 bg-rose-50" : "text-gray-400 hover:text-rose-400"
                      }`}
                    >
                      {hearted ? "❤️" : "🤍"}
                      <span data-testid={`cw-heart-count-${cel.celId}`}>
                        {cel.hearts.length}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
