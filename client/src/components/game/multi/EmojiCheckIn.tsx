import React from "react";

export interface EmojiCheckInConfig {
  title: string;
  question: string;
  emojiOptions: string[];
  maxNoteLength: number;
  noteRequired: boolean;
  showAuthor: boolean;
}

export interface CheckInEntry {
  entryId: string;
  userId: string;
  userName: string;
  emoji: string;
  note: string;
}

export interface EmojiCheckInState extends Record<string, unknown> {
  entries: CheckInEntry[];
  revealed: boolean;
}

interface Props {
  config: EmojiCheckInConfig;
  state: EmojiCheckInState;
  myUserId: string;
  selectedEmoji: string | null;
  noteText: string;
  onSelectEmoji: (emoji: string) => void;
  onNoteChange: (text: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

export default function EmojiCheckIn({
  config,
  state,
  myUserId,
  selectedEmoji,
  noteText,
  onSelectEmoji,
  onNoteChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, question, emojiOptions, maxNoteLength, noteRequired, showAuthor } = config;
  const { entries, revealed } = state;

  const myEntry = entries.find((e) => e.userId === myUserId);
  const hasSubmitted = !!myEntry;
  const canSubmit = !!selectedEmoji && (!noteRequired || noteText.trim().length > 0);

  // Group by emoji for visualization
  const emojiGroups = emojiOptions.map((emoji) => ({
    emoji,
    entries: entries.filter((e) => e.emoji === emoji),
  })).filter((g) => g.entries.length > 0);

  return (
    <div data-testid="eci-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="eci-title" className="text-lg font-bold text-center">{title}</h2>

      {/* 問題 */}
      <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-center">
        <p data-testid="eci-question" className="text-sm text-yellow-800 font-medium">{question}</p>
      </div>

      {/* 輸入區 */}
      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-3">
          {/* Emoji 選擇 */}
          <div className="flex gap-2 flex-wrap justify-center">
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                data-testid={`eci-emoji-${emoji}`}
                onClick={() => onSelectEmoji(emoji)}
                className={[
                  "text-3xl p-2 rounded-xl border-2 transition-all",
                  selectedEmoji === emoji
                    ? "border-yellow-400 bg-yellow-50 scale-110 shadow-md"
                    : "border-gray-200 bg-white hover:border-yellow-200",
                ].join(" ")}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* 備註輸入 */}
          {selectedEmoji && (
            <div>
              <textarea
                data-testid="eci-note-input"
                value={noteText}
                onChange={(e) => onNoteChange(e.target.value)}
                maxLength={maxNoteLength}
                rows={1}
                placeholder={noteRequired ? "請說明原因…" : "補充說明（可不填）"}
                className="w-full px-3 py-2 text-sm rounded-xl border-2 border-gray-200 focus:border-yellow-400 focus:outline-none resize-none"
              />
            </div>
          )}

          <button
            data-testid="eci-submit-btn"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors self-center"
          >
            打卡 {selectedEmoji ?? ""}
          </button>
        </div>
      )}

      {/* 已打卡 */}
      {hasSubmitted && !revealed && (
        <p data-testid="eci-submitted-msg" className="text-center text-3xl">
          {myEntry.emoji}
          <span className="block text-sm text-green-600 font-semibold mt-1">✅ 打卡完成！</span>
        </p>
      )}

      {/* 揭曉控制 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="eci-count">{entries.length}</span> 人已打卡
          </p>
          <button
            data-testid="eci-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            揭曉所有表情
          </button>
        </div>
      )}

      {/* 揭曉後：表情雲 */}
      {revealed && (
        <div data-testid="eci-result" className="flex flex-col gap-4">
          <p className="text-center text-yellow-600 text-sm font-semibold">
            共 {entries.length} 人打卡
          </p>

          {entries.length === 0 ? (
            <p data-testid="eci-empty" className="text-center text-gray-400 text-sm py-4">
              還沒有人打卡
            </p>
          ) : (
            <>
              {/* 表情雲分佈 */}
              <div data-testid="eci-cloud" className="flex gap-3 flex-wrap justify-center py-2">
                {emojiGroups.map(({ emoji, entries: groupEntries }) => (
                  <div key={emoji} data-testid={`eci-group-${emoji}`} className="flex flex-col items-center gap-1">
                    <span className="text-4xl">{emoji}</span>
                    <span data-testid={`eci-group-count-${emoji}`} className="text-xs font-bold text-gray-500">
                      {groupEntries.length}
                    </span>
                  </div>
                ))}
              </div>

              {/* 個人卡片 */}
              <div className="flex flex-col gap-2">
                {entries.map((entry) => (
                  <div
                    key={entry.entryId}
                    data-testid={`eci-entry-${entry.entryId}`}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm"
                  >
                    <span className="text-2xl">{entry.emoji}</span>
                    <div className="flex flex-col flex-1 min-w-0">
                      {showAuthor && (
                        <p data-testid={`eci-author-${entry.entryId}`} className="text-xs text-gray-400 font-semibold">
                          {entry.userName}
                        </p>
                      )}
                      {entry.note && (
                        <p data-testid={`eci-note-${entry.entryId}`} className="text-sm text-gray-600 truncate">
                          {entry.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
