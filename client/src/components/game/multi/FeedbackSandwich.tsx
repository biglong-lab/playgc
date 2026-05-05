import React from "react";

export interface FeedbackSandwichConfig {
  title: string;
  targetName: string;
  goodPrompt: string;
  betterPrompt: string;
  goPrompt: string;
  maxLength: number;
  showAuthor: boolean;
}

export interface SandwichEntry {
  entryId: string;
  userId: string;
  userName: string;
  good: string;
  better: string;
  go: string;
}

export interface FeedbackSandwichState extends Record<string, unknown> {
  entries: SandwichEntry[];
  revealed: boolean;
}

interface DraftFeedback {
  good: string;
  better: string;
  go: string;
}

interface Props {
  config: FeedbackSandwichConfig;
  state: FeedbackSandwichState;
  myUserId: string;
  draft: DraftFeedback;
  onDraftChange: (field: keyof DraftFeedback, value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

const SECTIONS = [
  { key: "good" as const, emoji: "✅", label: "Good", bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
  { key: "better" as const, emoji: "⬆️", label: "Better", bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" },
  { key: "go" as const, emoji: "🚀", label: "Go", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
] as const;

export default function FeedbackSandwich({
  config,
  state,
  myUserId,
  draft,
  onDraftChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, targetName, goodPrompt, betterPrompt, goPrompt, maxLength, showAuthor } = config;
  const { entries, revealed } = state;

  const prompts = { good: goodPrompt, better: betterPrompt, go: goPrompt };

  const myEntry = entries.find((e) => e.userId === myUserId);
  const hasSubmitted = !!myEntry;
  const canSubmit = draft.good.trim().length > 0 && draft.better.trim().length > 0 && draft.go.trim().length > 0;

  return (
    <div data-testid="fs-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="fs-title" className="text-lg font-bold text-center">{title}</h2>

      {/* 對象說明 */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
        <p className="text-xs text-gray-500 font-medium">回饋對象</p>
        <p data-testid="fs-target" className="text-sm font-bold text-gray-700">{targetName}</p>
      </div>

      {/* 輸入區 */}
      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-3">
          {SECTIONS.map((section) => (
            <div key={section.key} className={`rounded-xl border ${section.border} ${section.bg} overflow-hidden`}>
              <div className={`px-3 py-2 flex items-center gap-2 border-b ${section.border}`}>
                <span>{section.emoji}</span>
                <span className={`text-sm font-bold ${section.text}`}>{section.label}</span>
                <span className="text-xs text-gray-400 ml-1">{prompts[section.key]}</span>
              </div>
              <textarea
                data-testid={`fs-input-${section.key}`}
                value={draft[section.key]}
                onChange={(e) => onDraftChange(section.key, e.target.value)}
                maxLength={maxLength}
                rows={2}
                placeholder="寫下你的想法…"
                className="w-full px-3 py-2 text-sm resize-none focus:outline-none bg-transparent"
              />
            </div>
          ))}

          <button
            data-testid="fs-submit-btn"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors self-end"
          >
            送出反饋
          </button>
        </div>
      )}

      {/* 已送出 */}
      {hasSubmitted && !revealed && (
        <div data-testid="fs-submitted-msg" className="rounded-xl bg-green-50 border border-green-200 p-3">
          <p className="text-sm font-semibold text-green-700">✅ 反饋已送出！</p>
          <p className="text-xs text-green-500 mt-1">等待所有人完成後揭曉</p>
        </div>
      )}

      {/* 揭曉控制 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="fs-count">{entries.length}</span> 人已送出
          </p>
          <button
            data-testid="fs-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            揭曉所有反饋
          </button>
        </div>
      )}

      {/* 揭曉後：按 Good/Better/Go 聚合 */}
      {revealed && (
        <div data-testid="fs-result" className="flex flex-col gap-4">
          <p className="text-center text-indigo-600 text-sm font-semibold">
            📋 共 {entries.length} 則反饋
          </p>
          {entries.length === 0 ? (
            <p data-testid="fs-empty" className="text-center text-gray-400 text-sm py-4">
              還沒有人送出
            </p>
          ) : (
            SECTIONS.map((section) => (
              <div key={section.key} data-testid={`fs-section-${section.key}`} className="flex flex-col gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${section.bg} border ${section.border}`}>
                  <span>{section.emoji}</span>
                  <span className={`text-sm font-bold ${section.text}`}>{section.label}</span>
                  <span className="ml-auto text-xs text-gray-400">{entries.length} 則</span>
                </div>
                {entries.map((entry) => (
                  <div
                    key={`${section.key}-${entry.entryId}`}
                    data-testid={`fs-${section.key}-${entry.entryId}`}
                    className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm ml-2"
                  >
                    {showAuthor && (
                      <p data-testid={`fs-author-${section.key}-${entry.entryId}`} className="text-xs text-gray-400 mb-1 font-semibold">
                        {entry.userName}
                      </p>
                    )}
                    <p className="text-sm text-gray-700">{entry[section.key]}</p>
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
