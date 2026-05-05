import React from "react";

export interface HopeFearConfig {
  title: string;
  topic: string;
  hopeLabel: string;
  hopePrompt: string;
  fearLabel: string;
  fearPrompt: string;
  maxLength: number;
  showAuthor: boolean;
}

export interface HopeFearEntry {
  entryId: string;
  userId: string;
  userName: string;
  hope: string;
  fear: string;
}

export interface HopeFearState extends Record<string, unknown> {
  entries: HopeFearEntry[];
  revealed: boolean;
}

interface Draft {
  hope: string;
  fear: string;
}

interface Props {
  config: HopeFearConfig;
  state: HopeFearState;
  myUserId: string;
  draft: Draft;
  onDraftChange: (field: keyof Draft, value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

const SIDES = [
  {
    key: "hope" as const,
    configLabel: "hopeLabel" as const,
    configPrompt: "hopePrompt" as const,
    emoji: "🌟",
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-700",
    divider: "border-sky-100",
  },
  {
    key: "fear" as const,
    configLabel: "fearLabel" as const,
    configPrompt: "fearPrompt" as const,
    emoji: "⚡",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    divider: "border-orange-100",
  },
] as const;

export default function HopeFear({
  config,
  state,
  myUserId,
  draft,
  onDraftChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, topic, maxLength, showAuthor } = config;
  const { entries, revealed } = state;

  const myEntry = entries.find((e) => e.userId === myUserId);
  const hasSubmitted = !!myEntry;
  const canSubmit = draft.hope.trim().length > 0 && draft.fear.trim().length > 0;

  return (
    <div data-testid="hf-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="hf-title" className="text-lg font-bold text-center">{title}</h2>

      {/* 主題說明 */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
        <p className="text-xs text-gray-400 font-medium">關於</p>
        <p data-testid="hf-topic" className="text-sm font-bold text-gray-700">{topic}</p>
      </div>

      {/* 輸入區：兩欄並列 */}
      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-3">
          {SIDES.map((side) => (
            <div key={side.key} className={`rounded-xl border ${side.border} ${side.bg} overflow-hidden`}>
              <div className={`px-3 py-2 flex items-center gap-2 border-b ${side.border}`}>
                <span>{side.emoji}</span>
                <span className={`text-sm font-bold ${side.text}`}>{config[side.configLabel]}</span>
                <span className="text-xs text-gray-400 ml-1">{config[side.configPrompt]}</span>
              </div>
              <textarea
                data-testid={`hf-input-${side.key}`}
                value={draft[side.key]}
                onChange={(e) => onDraftChange(side.key, e.target.value)}
                maxLength={maxLength}
                rows={2}
                placeholder="寫下你的想法…"
                className="w-full px-3 py-2 text-sm resize-none focus:outline-none bg-transparent"
              />
            </div>
          ))}

          <button
            data-testid="hf-submit-btn"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors self-end"
          >
            送出
          </button>
        </div>
      )}

      {/* 已送出 */}
      {hasSubmitted && !revealed && (
        <div data-testid="hf-submitted-msg" className="rounded-xl bg-indigo-50 border border-indigo-200 p-3">
          <p className="text-sm font-semibold text-indigo-700">✅ 已送出！</p>
          <p className="text-xs text-indigo-400 mt-1">等待所有人完成後揭曉</p>
        </div>
      )}

      {/* 揭曉控制 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="hf-count">{entries.length}</span> 人已送出
          </p>
          <button
            data-testid="hf-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            揭曉全體期待與擔憂
          </button>
        </div>
      )}

      {/* 揭曉後：兩欄呈現 */}
      {revealed && (
        <div data-testid="hf-result" className="flex flex-col gap-4">
          <p className="text-center text-indigo-600 text-sm font-semibold">
            📊 共 {entries.length} 人參與
          </p>
          {entries.length === 0 ? (
            <p data-testid="hf-empty" className="text-center text-gray-400 text-sm py-4">
              還沒有人送出
            </p>
          ) : (
            SIDES.map((side) => (
              <div key={side.key} data-testid={`hf-section-${side.key}`} className="flex flex-col gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${side.bg} ${side.border}`}>
                  <span>{side.emoji}</span>
                  <span className={`text-sm font-bold ${side.text}`}>{config[side.configLabel]}</span>
                  <span className="ml-auto text-xs text-gray-400">{entries.length} 則</span>
                </div>
                {entries.map((entry) => (
                  <div
                    key={`${side.key}-${entry.entryId}`}
                    data-testid={`hf-${side.key}-${entry.entryId}`}
                    className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm ml-2"
                  >
                    {showAuthor && (
                      <p data-testid={`hf-author-${side.key}-${entry.entryId}`} className="text-xs text-gray-400 mb-1 font-semibold">
                        {entry.userName}
                      </p>
                    )}
                    <p className="text-sm text-gray-700">{entry[side.key]}</p>
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
