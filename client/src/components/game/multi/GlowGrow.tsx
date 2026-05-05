import React from "react";

export interface GlowGrowConfig {
  title: string;
  prompt: string;
  glowLabel: string;
  glowPrompt: string;
  growLabel: string;
  growPrompt: string;
  maxLength: number;
  showAuthor: boolean;
}

export interface GlowGrowEntry {
  entryId: string;
  userId: string;
  userName: string;
  glow: string;
  grow: string;
}

export interface GlowGrowState extends Record<string, unknown> {
  entries: GlowGrowEntry[];
  revealed: boolean;
}

interface DraftGG {
  glow: string;
  grow: string;
}

interface Props {
  config: GlowGrowConfig;
  state: GlowGrowState;
  myUserId: string;
  draft: DraftGG;
  onDraftChange: (field: keyof DraftGG, value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

const SECTIONS = [
  {
    key: "glow" as const,
    configKey: "glowLabel" as const,
    promptKey: "glowPrompt" as const,
    emoji: "✨",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    sectionBg: "bg-yellow-50 border-yellow-200",
  },
  {
    key: "grow" as const,
    configKey: "growLabel" as const,
    promptKey: "growPrompt" as const,
    emoji: "🌱",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    sectionBg: "bg-green-50 border-green-200",
  },
] as const;

export default function GlowGrow({
  config,
  state,
  myUserId,
  draft,
  onDraftChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, prompt, maxLength, showAuthor } = config;
  const { entries, revealed } = state;

  const myEntry = entries.find((e) => e.userId === myUserId);
  const hasSubmitted = !!myEntry;
  const canSubmit = draft.glow.trim().length > 0 && draft.grow.trim().length > 0;

  return (
    <div data-testid="gg-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="gg-title" className="text-lg font-bold text-center">{title}</h2>
      <p data-testid="gg-prompt" className="text-sm text-gray-500 text-center">{prompt}</p>

      {/* 輸入區 */}
      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-3">
          {SECTIONS.map((section) => (
            <div key={section.key} className={`rounded-xl border ${section.border} ${section.bg} overflow-hidden`}>
              <div className={`px-3 py-2 flex items-center gap-2 border-b ${section.border}`}>
                <span>{section.emoji}</span>
                <span className={`text-sm font-bold ${section.text}`}>{config[section.configKey]}</span>
                <span className="text-xs text-gray-400 ml-1">{config[section.promptKey]}</span>
              </div>
              <textarea
                data-testid={`gg-input-${section.key}`}
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
            data-testid="gg-submit-btn"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors self-end"
          >
            送出反思
          </button>
        </div>
      )}

      {/* 已送出 */}
      {hasSubmitted && !revealed && (
        <div data-testid="gg-submitted-msg" className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
          <p className="text-sm font-semibold text-emerald-700">✅ 反思已送出！</p>
          <p className="text-xs text-emerald-500 mt-1">等待所有人完成後揭曉</p>
        </div>
      )}

      {/* 揭曉控制 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="gg-count">{entries.length}</span> 人已送出
          </p>
          <button
            data-testid="gg-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            揭曉大家的反思
          </button>
        </div>
      )}

      {/* 揭曉後：按 Glow / Grow 聚合 */}
      {revealed && (
        <div data-testid="gg-result" className="flex flex-col gap-4">
          <p className="text-center text-emerald-600 text-sm font-semibold">
            🔍 共 {entries.length} 則反思
          </p>
          {entries.length === 0 ? (
            <p data-testid="gg-empty" className="text-center text-gray-400 text-sm py-4">
              還沒有人送出
            </p>
          ) : (
            SECTIONS.map((section) => (
              <div key={section.key} data-testid={`gg-section-${section.key}`} className="flex flex-col gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${section.sectionBg}`}>
                  <span>{section.emoji}</span>
                  <span className={`text-sm font-bold ${section.text}`}>{config[section.configKey]}</span>
                  <span className="ml-auto text-xs text-gray-400">{entries.length} 則</span>
                </div>
                {entries.map((entry) => (
                  <div
                    key={`${section.key}-${entry.entryId}`}
                    data-testid={`gg-${section.key}-${entry.entryId}`}
                    className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm ml-2"
                  >
                    {showAuthor && (
                      <p data-testid={`gg-author-${section.key}-${entry.entryId}`} className="text-xs text-gray-400 mb-1 font-semibold">
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
