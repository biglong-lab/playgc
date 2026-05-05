import { useState } from "react";

export interface StoryLine extends Record<string, unknown> {
  lineId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface OneLineStoryConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
}

export interface OneLineStoryState extends Record<string, unknown> {
  lines: StoryLine[];
  revealed: boolean;
}

const DEFAULT_CONFIG: OneLineStoryConfig = {
  title: "一句故事",
  prompt: "用一句話說一個故事，開頭是「那天，」",
  maxLength: 80,
};

interface Props {
  config: OneLineStoryConfig;
  state: OneLineStoryState;
  myUserId: string;
  onSubmit: (text: string) => void;
  onReveal: () => void;
}

export default function OneLineStory({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
}: Props) {
  const [input, setInput] = useState("");
  const { title, prompt, maxLength } = config || DEFAULT_CONFIG;
  const { lines, revealed } = state;

  const myLine = lines.find((l) => l.userId === myUserId);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setInput("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="ols-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <div
        data-testid="ols-prompt"
        className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 text-sm text-indigo-700 italic text-center"
      >
        {prompt}
      </div>

      {!revealed && (
        <div className="space-y-3">
          {!myLine ? (
            <div className="space-y-2">
              <div className="relative">
                <input
                  data-testid="ols-input"
                  type="text"
                  value={input}
                  onChange={(e) => {
                    if (e.target.value.length <= maxLength) setInput(e.target.value);
                  }}
                  placeholder="你的一句故事..."
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {input.length}/{maxLength}
                </span>
              </div>
              <button
                data-testid="ols-submit-btn"
                onClick={handleSubmit}
                disabled={input.trim().length === 0}
                className="w-full py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 disabled:opacity-40"
              >
                📖 加入故事牆
              </button>
            </div>
          ) : (
            <div
              data-testid="ols-my-line"
              className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center"
            >
              <p className="text-xs text-indigo-400 mb-1">✅ 你的故事</p>
              <p className="text-sm italic text-indigo-700">「{myLine.text}」</p>
            </div>
          )}

          <p className="text-xs text-center text-gray-400">
            已有 <span data-testid="ols-count">{lines.length}</span> 個故事
          </p>

          <div className="text-center">
            <button
              data-testid="ols-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布所有故事
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div data-testid="ols-result" className="space-y-3">
          {lines.length === 0 ? (
            <div data-testid="ols-empty" className="text-center text-gray-400 py-8">
              尚無故事
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div
                  key={l.lineId}
                  data-testid={`ols-line-${l.lineId}`}
                  className="p-3 bg-white border border-gray-200 rounded-xl"
                >
                  <p className="text-sm italic text-gray-700">「{l.text}」</p>
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    — {l.userName}
                  </p>
                  {idx === 0 && (
                    <span
                      data-testid="ols-first-badge"
                      className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full"
                    >
                      ⭐ 第一個
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
