import React from "react";

export interface CollectivePoemConfig {
  title: string;
  prompt: string;
  starter?: string;
  maxLength: number;
  showAuthor: boolean;
  maxLinesPerUser: number;
}

export interface PoemLine {
  lineId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface CollectivePoemState extends Record<string, unknown> {
  lines: PoemLine[];
  revealed: boolean;
}

interface Props {
  config: CollectivePoemConfig;
  state: CollectivePoemState;
  myUserId: string;
  draftLine: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

export default function CollectivePoem({
  config,
  state,
  myUserId,
  draftLine,
  onDraftChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, prompt, starter, maxLength, showAuthor, maxLinesPerUser } = config;
  const { lines, revealed } = state;

  const myLineCount = lines.filter((l) => l.userId === myUserId).length;
  const hasReachedLimit = myLineCount >= maxLinesPerUser;
  const canSubmit = draftLine.trim().length > 0 && !hasReachedLimit;

  return (
    <div data-testid="cp-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="cp-title" className="text-lg font-bold text-center">{title}</h2>
      <p data-testid="cp-prompt" className="text-sm text-gray-500 text-center">{prompt}</p>

      {/* 首句提示 */}
      {starter && (
        <div className="rounded-xl bg-purple-50 border border-purple-200 p-3 text-center">
          <p className="text-xs text-purple-400 mb-1">開篇</p>
          <p data-testid="cp-starter" className="text-sm font-medium italic text-purple-700">{starter}</p>
        </div>
      )}

      {/* 已有詩句預覽（未揭曉時也顯示，讓人感受到集體創作） */}
      {lines.length > 0 && !revealed && (
        <div data-testid="cp-preview" className="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-2 text-center">{lines.length} 行詩句已加入</p>
          <div className="flex flex-col gap-1">
            {lines.map((line) => (
              <p key={line.lineId} data-testid={`cp-preview-line-${line.lineId}`} className="text-sm text-gray-600 italic">
                {line.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 輸入區 */}
      {!revealed && (
        <div className="flex flex-col gap-2">
          {hasReachedLimit ? (
            <p data-testid="cp-limit-msg" className="text-xs text-amber-500 text-center">
              已達每人上限（{maxLinesPerUser} 行）
            </p>
          ) : (
            <>
              <textarea
                data-testid="cp-input"
                value={draftLine}
                onChange={(e) => onDraftChange(e.target.value)}
                maxLength={maxLength}
                rows={2}
                placeholder="寫下你的詩句…"
                className="w-full rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{draftLine.length}/{maxLength}</span>
                <button
                  data-testid="cp-submit-btn"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  加入詩句
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 揭曉控制 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="cp-count">{lines.length}</span> 行已加入
          </p>
          <button
            data-testid="cp-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            揭曉完整詩篇
          </button>
        </div>
      )}

      {/* 揭曉後：完整詩篇 */}
      {revealed && (
        <div data-testid="cp-result" className="flex flex-col gap-2">
          <p className="text-center text-purple-600 text-sm font-semibold">
            📜 集體詩篇（共 {lines.length} 行）
          </p>

          {lines.length === 0 ? (
            <p data-testid="cp-empty" className="text-center text-gray-400 text-sm py-4">
              還沒有人加入詩句
            </p>
          ) : (
            <div className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-5 shadow-sm">
              {starter && (
                <p className="text-sm italic text-purple-500 mb-2">{starter}</p>
              )}
              {lines.map((line, idx) => (
                <div key={line.lineId} data-testid={`cp-line-${line.lineId}`} className="mb-2">
                  <p className="text-sm text-gray-700 italic">{line.text}</p>
                  {showAuthor && (
                    <p data-testid={`cp-author-${line.lineId}`} className="text-xs text-gray-400 text-right">
                      — {line.userName}
                    </p>
                  )}
                  {idx < lines.length - 1 && (
                    <div className="border-b border-purple-100 mt-2" />
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
