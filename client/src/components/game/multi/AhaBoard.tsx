import { useState } from "react";

export interface AhaMoment extends Record<string, unknown> {
  ahaId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface AhaBoardConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
}

export interface AhaBoardState extends Record<string, unknown> {
  moments: AhaMoment[];
  revealed: boolean;
}

const DEFAULT_CONFIG: AhaBoardConfig = {
  title: "頓悟時刻",
  prompt: "你今天最大的「啊哈！」是什麼？",
  maxLength: 100,
};

const AHA_COLORS = [
  "bg-yellow-50 border-yellow-300 text-yellow-900",
  "bg-orange-50 border-orange-300 text-orange-900",
  "bg-lime-50 border-lime-300 text-lime-900",
  "bg-sky-50 border-sky-300 text-sky-900",
  "bg-violet-50 border-violet-300 text-violet-900",
  "bg-rose-50 border-rose-300 text-rose-900",
];

interface Props {
  config: AhaBoardConfig;
  state: AhaBoardState;
  myUserId: string;
  onSubmit: (text: string) => void;
  onReveal: () => void;
}

export default function AhaBoard({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
}: Props) {
  const [input, setInput] = useState("");
  const { title, prompt, maxLength } = config || DEFAULT_CONFIG;
  const { moments, revealed } = state;

  const myMoment = moments.find((m) => m.userId === myUserId);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setInput("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="ab-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <p data-testid="ab-prompt" className="text-sm text-gray-600 text-center">
        {prompt}
      </p>

      {!revealed && (
        <div className="space-y-3">
          {!myMoment ? (
            <div className="space-y-2">
              <div className="relative">
                <textarea
                  data-testid="ab-input"
                  value={input}
                  onChange={(e) => {
                    if (e.target.value.length <= maxLength) setInput(e.target.value);
                  }}
                  placeholder="寫下你的頓悟..."
                  rows={3}
                  className="w-full border-2 border-yellow-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 resize-none pr-12 bg-yellow-50"
                />
                <span className="absolute right-3 bottom-2 text-xs text-gray-400">
                  {input.length}/{maxLength}
                </span>
              </div>
              <button
                data-testid="ab-submit-btn"
                onClick={handleSubmit}
                disabled={input.trim().length === 0}
                className="w-full py-2 bg-yellow-400 text-yellow-900 rounded-xl text-sm font-bold hover:bg-yellow-500 disabled:opacity-40"
              >
                💡 貼上頓悟牆
              </button>
            </div>
          ) : (
            <div
              data-testid="ab-my-moment"
              className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl text-center"
            >
              <p className="text-xs text-yellow-600 mb-1">✅ 你的頓悟</p>
              <p className="text-sm font-semibold text-yellow-900">{myMoment.text}</p>
            </div>
          )}

          <p className="text-xs text-center text-gray-400">
            已有 <span data-testid="ab-count">{moments.length}</span> 人分享頓悟
          </p>

          <div className="text-center">
            <button
              data-testid="ab-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布頓悟牆
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div data-testid="ab-result" className="space-y-2">
          {moments.length === 0 ? (
            <div data-testid="ab-empty" className="text-center text-gray-400 py-8">
              尚無人分享
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {moments.map((m, idx) => (
                <div
                  key={m.ahaId}
                  data-testid={`ab-card-${m.ahaId}`}
                  className={`p-3 border rounded-xl ${AHA_COLORS[idx % AHA_COLORS.length]}`}
                >
                  <p className="text-sm font-medium">💡 {m.text}</p>
                  <p className="text-xs opacity-60 mt-1">— {m.userName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
