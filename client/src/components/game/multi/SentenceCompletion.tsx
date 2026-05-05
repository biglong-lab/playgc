import React from "react";

export interface SentenceCompletionConfig {
  title: string;
  starter: string;
  maxLength: number;
  maxPerPerson: number;
  reactions: string[];
  showAuthor: boolean;
}

export interface SentenceEntry {
  entryId: string;
  userId: string;
  userName: string;
  text: string;
  reactions: Record<string, string[]>; // emoji → userIds
}

export interface SentenceCompletionState extends Record<string, unknown> {
  entries: SentenceEntry[];
  revealed: boolean;
}

interface Props {
  config: SentenceCompletionConfig;
  state: SentenceCompletionState;
  myUserId: string;
  draftText: string;
  onDraftChange: (text: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
  onReact: (entryId: string, emoji: string) => void;
}

export default function SentenceCompletion({
  config,
  state,
  myUserId,
  draftText,
  onDraftChange,
  onSubmit,
  onReveal,
  onReact,
}: Props) {
  const { title, starter, maxLength, maxPerPerson, reactions, showAuthor } = config;
  const { entries, revealed } = state;

  const myEntries = entries.filter((e) => e.userId === myUserId);
  const hasReachedLimit = myEntries.length >= maxPerPerson;
  const charsLeft = maxLength - draftText.length;
  const canSubmit = draftText.trim().length > 0 && !hasReachedLimit;

  return (
    <div data-testid="sc-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="sc-title" className="text-lg font-bold text-center">{title}</h2>

      {/* 句子開頭 */}
      <div data-testid="sc-starter" className="rounded-xl bg-purple-50 border border-purple-200 p-3 text-center">
        <p className="font-semibold text-purple-800 text-sm">{starter}…</p>
      </div>

      {/* 輸入區 */}
      {!hasReachedLimit && !revealed && (
        <div className="flex flex-col gap-2">
          <div className="rounded-xl border-2 border-gray-200 focus-within:border-purple-400 overflow-hidden">
            <div className="bg-purple-50 px-3 py-2 text-sm text-purple-600 font-medium border-b border-gray-100">
              {starter}
            </div>
            <textarea
              data-testid="sc-input"
              value={draftText}
              onChange={(e) => onDraftChange(e.target.value)}
              maxLength={maxLength}
              rows={2}
              placeholder="…繼續完成這句話"
              className="w-full px-3 py-2 text-sm resize-none focus:outline-none"
            />
          </div>
          <div className="flex justify-between items-center">
            <span data-testid="sc-chars-left" className="text-xs text-gray-400">
              還可輸入 {charsLeft} 字
            </span>
            <button
              data-testid="sc-submit-btn"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="px-4 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              送出
            </button>
          </div>
        </div>
      )}

      {/* 達上限提示 */}
      {hasReachedLimit && !revealed && (
        <p data-testid="sc-limit-msg" className="text-center text-green-600 text-sm font-semibold">
          ✅ 已送出 {myEntries.length} 則（上限）
        </p>
      )}

      {/* 揭曉控制區 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="sc-count">{entries.length}</span> 則已送出
          </p>
          <button
            data-testid="sc-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            全部揭曉
          </button>
        </div>
      )}

      {/* 揭曉後：所有回答 */}
      {revealed && (
        <div data-testid="sc-entries" className="flex flex-col gap-3">
          <p className="text-center text-purple-600 text-sm font-semibold">
            💬 共 {entries.length} 則完成句子
          </p>
          {entries.length === 0 ? (
            <p data-testid="sc-empty" className="text-center text-gray-400 text-sm py-4">還沒有人送出</p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.entryId}
                data-testid={`sc-entry-${entry.entryId}`}
                className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
              >
                {showAuthor && (
                  <p data-testid={`sc-author-${entry.entryId}`} className="text-xs text-gray-400 mb-1 font-semibold">
                    {entry.userName}
                  </p>
                )}
                <p data-testid={`sc-text-${entry.entryId}`} className="text-sm text-gray-700">
                  <span className="text-purple-500 font-medium">{starter}</span>{" "}
                  {entry.text}
                </p>
                {/* Emoji 反應列 */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {reactions.map((emoji) => {
                    const voters = entry.reactions[emoji] ?? [];
                    const myReacted = voters.includes(myUserId);
                    return (
                      <button
                        key={emoji}
                        data-testid={`sc-react-${entry.entryId}-${emoji}`}
                        onClick={() => onReact(entry.entryId, emoji)}
                        className={[
                          "flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors",
                          myReacted
                            ? "bg-purple-100 border-purple-300 text-purple-700 font-bold"
                            : "bg-gray-50 border-gray-200 text-gray-500 hover:border-purple-200",
                        ].join(" ")}
                      >
                        <span>{emoji}</span>
                        {voters.length > 0 && (
                          <span data-testid={`sc-react-count-${entry.entryId}-${emoji}`}>{voters.length}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
