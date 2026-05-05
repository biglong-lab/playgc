import { useState } from "react";

export interface IntentionCard extends Record<string, unknown> {
  intentionId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface DailyIntentionConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
}

export interface DailyIntentionState extends Record<string, unknown> {
  intentions: IntentionCard[];
  revealed: boolean;
}

const DEFAULT_CONFIG: DailyIntentionConfig = {
  title: "今日意圖",
  prompt: "今天你最想專注在什麼上面？",
  maxLength: 60,
};

interface Props {
  config: DailyIntentionConfig;
  state: DailyIntentionState;
  myUserId: string;
  onSubmit: (text: string) => void;
  onReveal: () => void;
}

export default function DailyIntention({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
}: Props) {
  const [input, setInput] = useState("");
  const { title, prompt, maxLength } = config || DEFAULT_CONFIG;
  const { intentions, revealed } = state;

  const myCard = intentions.find((c) => c.userId === myUserId);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setInput("");
  }

  const CARD_COLORS = [
    "bg-rose-50 border-rose-200 text-rose-800",
    "bg-amber-50 border-amber-200 text-amber-800",
    "bg-emerald-50 border-emerald-200 text-emerald-800",
    "bg-sky-50 border-sky-200 text-sky-800",
    "bg-violet-50 border-violet-200 text-violet-800",
    "bg-pink-50 border-pink-200 text-pink-800",
  ];

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="di-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <p data-testid="di-prompt" className="text-sm text-gray-600 text-center">
        {prompt}
      </p>

      {!revealed && (
        <div className="space-y-3">
          {!myCard ? (
            <div className="space-y-2">
              <div className="relative">
                <input
                  data-testid="di-input"
                  type="text"
                  value={input}
                  onChange={(e) => {
                    if (e.target.value.length <= maxLength) setInput(e.target.value);
                  }}
                  placeholder="寫下今天的意圖（一句話）..."
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {input.length}/{maxLength}
                </span>
              </div>
              <button
                data-testid="di-submit-btn"
                onClick={handleSubmit}
                disabled={input.trim().length === 0}
                className="w-full py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 disabled:opacity-40"
              >
                放入今日意圖牆
              </button>
            </div>
          ) : (
            <div
              data-testid="di-my-card"
              className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-center"
            >
              <p className="text-xs text-indigo-400 mb-1">✅ 你的意圖</p>
              <p className="text-sm font-semibold text-indigo-700">{myCard.text}</p>
            </div>
          )}

          <p className="text-xs text-center text-gray-400">
            已有 <span data-testid="di-count">{intentions.length}</span> 人寫下意圖
          </p>

          <div className="text-center">
            <button
              data-testid="di-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布意圖牆
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div data-testid="di-result" className="space-y-3">
          {intentions.length === 0 ? (
            <div data-testid="di-empty" className="text-center text-gray-400 py-8">
              尚無人寫下意圖
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {intentions.map((card, idx) => (
                <div
                  key={card.intentionId}
                  data-testid={`di-card-${card.intentionId}`}
                  className={`p-3 border rounded-xl ${CARD_COLORS[idx % CARD_COLORS.length]}`}
                >
                  <p className="text-sm font-semibold">{card.text}</p>
                  <p className="text-xs opacity-60 mt-1">— {card.userName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
