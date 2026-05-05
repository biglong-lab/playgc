import React from "react";

export interface ThinkingHat {
  hatId: string;
  color: string;
  emoji: string;
  name: string;
  description: string;
}

export const DEFAULT_HATS: ThinkingHat[] = [
  { hatId: "white", color: "bg-gray-100 border-gray-300 text-gray-700", emoji: "⚪", name: "白帽", description: "事實與數據" },
  { hatId: "red", color: "bg-red-100 border-red-300 text-red-700", emoji: "🔴", name: "紅帽", description: "情感與直覺" },
  { hatId: "black", color: "bg-gray-800 border-gray-600 text-white", emoji: "⚫", name: "黑帽", description: "批判與風險" },
  { hatId: "yellow", color: "bg-yellow-100 border-yellow-300 text-yellow-700", emoji: "🟡", name: "黃帽", description: "樂觀與優勢" },
  { hatId: "green", color: "bg-green-100 border-green-300 text-green-700", emoji: "🟢", name: "綠帽", description: "創意與可能" },
  { hatId: "blue", color: "bg-blue-100 border-blue-300 text-blue-700", emoji: "🔵", name: "藍帽", description: "流程與總結" },
];

export interface ThinkingHatsConfig {
  title: string;
  topic: string;
  hats: ThinkingHat[];
  maxLength: number;
  showAuthor: boolean;
}

export interface HatThought {
  thoughtId: string;
  userId: string;
  userName: string;
  hatId: string;
  text: string;
}

export interface ThinkingHatsState extends Record<string, unknown> {
  thoughts: HatThought[];
  revealed: boolean;
}

interface Props {
  config: ThinkingHatsConfig;
  state: ThinkingHatsState;
  myUserId: string;
  selectedHatId: string | null;
  draftText: string;
  onSelectHat: (hatId: string) => void;
  onDraftChange: (text: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

export default function ThinkingHats({
  config,
  state,
  myUserId,
  selectedHatId,
  draftText,
  onSelectHat,
  onDraftChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, topic, hats, maxLength, showAuthor } = config;
  const { thoughts, revealed } = state;

  const myThought = thoughts.find((t) => t.userId === myUserId);
  const hasSubmitted = !!myThought;
  const selectedHat = hats.find((h) => h.hatId === selectedHatId) ?? null;
  const canSubmit = !!selectedHatId && draftText.trim().length > 0;
  const charsLeft = maxLength - draftText.length;

  const groupedByHat = hats.map((hat) => ({
    hat,
    thoughts: thoughts.filter((t) => t.hatId === hat.hatId),
  })).filter((g) => g.thoughts.length > 0);

  return (
    <div data-testid="th-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="th-title" className="text-lg font-bold text-center">{title}</h2>

      {/* 主題 */}
      <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-center">
        <p data-testid="th-topic" className="text-sm text-indigo-700 font-semibold">{topic}</p>
      </div>

      {/* 輸入區 */}
      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-3">
          {/* 帽子選擇 */}
          <div className="grid grid-cols-3 gap-2">
            {hats.map((hat) => (
              <button
                key={hat.hatId}
                data-testid={`th-hat-${hat.hatId}`}
                onClick={() => onSelectHat(hat.hatId)}
                className={[
                  "flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 transition-all",
                  hat.color,
                  selectedHatId === hat.hatId ? "ring-2 ring-offset-1 ring-indigo-400 scale-105" : "opacity-70 hover:opacity-100",
                ].join(" ")}
              >
                <span className="text-lg">{hat.emoji}</span>
                <span className="text-xs font-bold">{hat.name}</span>
                <span className="text-xs opacity-75">{hat.description}</span>
              </button>
            ))}
          </div>

          {/* 思考輸入 */}
          {selectedHatId && (
            <div className="flex flex-col gap-2">
              <div className="rounded-xl border-2 border-gray-200 focus-within:border-indigo-400 overflow-hidden">
                <div className="bg-indigo-50 px-3 py-2 text-sm font-medium border-b border-gray-100 flex items-center gap-2">
                  <span>{selectedHat?.emoji}</span>
                  <span className="text-indigo-600">{selectedHat?.name}：{selectedHat?.description}</span>
                </div>
                <textarea
                  data-testid="th-input"
                  value={draftText}
                  onChange={(e) => onDraftChange(e.target.value)}
                  maxLength={maxLength}
                  rows={2}
                  placeholder="從這頂帽子的角度寫下你的想法…"
                  className="w-full px-3 py-2 text-sm resize-none focus:outline-none"
                />
              </div>
              <div className="flex justify-between items-center">
                <span data-testid="th-chars-left" className="text-xs text-gray-400">
                  還可輸入 {charsLeft} 字
                </span>
                <button
                  data-testid="th-submit-btn"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  送出
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 已送出 */}
      {hasSubmitted && !revealed && (
        <div data-testid="th-submitted-msg" className="rounded-xl bg-green-50 border border-green-200 p-3">
          <p className="text-sm font-semibold text-green-700">✅ 已送出！</p>
          <p className="text-sm text-green-600 mt-1">
            {hats.find((h) => h.hatId === myThought.hatId)?.emoji} {myThought.text}
          </p>
        </div>
      )}

      {/* 揭曉控制 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="th-count">{thoughts.length}</span> 則已送出
          </p>
          <button
            data-testid="th-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            揭曉所有想法
          </button>
        </div>
      )}

      {/* 揭曉後 */}
      {revealed && (
        <div data-testid="th-results" className="flex flex-col gap-4">
          <p className="text-center text-indigo-600 text-sm font-semibold">
            🎩 共 {thoughts.length} 則思考
          </p>
          {thoughts.length === 0 ? (
            <p data-testid="th-empty" className="text-center text-gray-400 text-sm py-4">
              還沒有人送出
            </p>
          ) : (
            groupedByHat.map(({ hat, thoughts: hatThoughts }) => (
              <div key={hat.hatId} data-testid={`th-group-${hat.hatId}`} className="flex flex-col gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${hat.color}`}>
                  <span>{hat.emoji}</span>
                  <span className="text-sm font-bold">{hat.name}</span>
                  <span className="text-xs opacity-75">— {hat.description}</span>
                  <span className="ml-auto text-xs font-semibold">{hatThoughts.length}</span>
                </div>
                {hatThoughts.map((t) => (
                  <div
                    key={t.thoughtId}
                    data-testid={`th-thought-${t.thoughtId}`}
                    className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm ml-2"
                  >
                    {showAuthor && (
                      <p data-testid={`th-author-${t.thoughtId}`} className="text-xs text-gray-400 mb-1 font-semibold">
                        {t.userName}
                      </p>
                    )}
                    <p data-testid={`th-text-${t.thoughtId}`} className="text-sm text-gray-700">
                      {t.text}
                    </p>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
