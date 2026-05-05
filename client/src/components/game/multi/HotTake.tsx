import React from "react";

export interface HotTakeConfig {
  title: string;
  instructions?: string;
  maxLength: number;
  maxTakesPerPerson: number;
  reactions: string[];
}

export interface HotTakeItem {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  reactions: Record<string, string[]>;
  submittedAt: number;
}

export interface HotTakeState extends Record<string, unknown> {
  takes: HotTakeItem[];
}

interface Props {
  config: HotTakeConfig;
  state: HotTakeState;
  myUserId: string;
  draftText: string;
  onDraftChange: (text: string) => void;
  onSubmit: () => void;
  onReact: (takeId: string, emoji: string) => void;
}

export default function HotTake({
  config,
  state,
  myUserId,
  draftText,
  onDraftChange,
  onSubmit,
  onReact,
}: Props) {
  const { title, instructions, maxLength, maxTakesPerPerson, reactions } = config;
  const { takes } = state;

  const myTakes = takes.filter((t) => t.authorId === myUserId);
  const hasReachedLimit = myTakes.length >= maxTakesPerPerson;
  const canSubmit = draftText.trim().length > 0 && !hasReachedLimit;
  const charsLeft = maxLength - draftText.length;

  const sortedTakes = [...takes].sort((a, b) => {
    const totalA = Object.values(a.reactions).reduce((s, arr) => s + arr.length, 0);
    const totalB = Object.values(b.reactions).reduce((s, arr) => s + arr.length, 0);
    return totalB - totalA || b.submittedAt - a.submittedAt;
  });

  return (
    <div data-testid="ht-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="ht-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      {instructions && (
        <p data-testid="ht-instructions" className="text-sm text-gray-500 text-center">
          {instructions}
        </p>
      )}

      {!hasReachedLimit ? (
        <div className="flex flex-col gap-2">
          <textarea
            data-testid="ht-input"
            value={draftText}
            onChange={(e) => onDraftChange(e.target.value.slice(0, maxLength))}
            placeholder="輸入你的熱議話題…"
            rows={2}
            className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <div className="flex justify-between items-center">
            <span
              data-testid="ht-chars-left"
              className={`text-xs ${charsLeft <= 10 ? "text-red-500" : "text-gray-400"}`}
            >
              {charsLeft}
            </span>
            <button
              data-testid="ht-submit-btn"
              disabled={!canSubmit}
              onClick={onSubmit}
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              發布
            </button>
          </div>
        </div>
      ) : (
        <p data-testid="ht-limit-msg" className="text-center text-sm text-amber-600">
          已達發布上限（{maxTakesPerPerson} 則）
        </p>
      )}

      <div className="flex items-center text-sm text-gray-500">
        共 <span data-testid="ht-count" className="mx-1 font-bold">{takes.length}</span> 則話題
      </div>

      {takes.length === 0 ? (
        <p data-testid="ht-empty" className="text-center text-gray-400 text-sm py-4">
          還沒有人發布話題…
        </p>
      ) : (
        <div data-testid="ht-list" className="flex flex-col gap-3">
          {sortedTakes.map((take) => {
            const totalReactions = Object.values(take.reactions).reduce(
              (s, arr) => s + arr.length,
              0
            );
            return (
              <div
                key={take.id}
                data-testid={`ht-take-${take.id}`}
                className={[
                  "rounded-xl border p-3 flex flex-col gap-2",
                  take.authorId === myUserId
                    ? "border-orange-300 bg-orange-50"
                    : "border-gray-200 bg-white",
                ].join(" ")}
              >
                <p data-testid={`ht-text-${take.id}`} className="text-sm font-medium">
                  {take.text}
                </p>
                <div className="flex justify-between items-center">
                  <span data-testid={`ht-author-${take.id}`} className="text-xs text-gray-400">
                    — {take.authorName}
                  </span>
                  <span data-testid={`ht-reaction-total-${take.id}`} className="text-xs text-gray-400">
                    {totalReactions} 個反應
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {reactions.map((emoji) => {
                    const voters = take.reactions[emoji] ?? [];
                    const isMine = voters.includes(myUserId);
                    return (
                      <button
                        key={emoji}
                        data-testid={`ht-react-${take.id}-${emoji}`}
                        onClick={() => onReact(take.id, emoji)}
                        className={[
                          "flex items-center gap-1 px-2 py-1 rounded-full text-sm border transition-all",
                          isMine
                            ? "border-orange-400 bg-orange-100 font-semibold"
                            : "border-gray-200 hover:border-orange-300 hover:bg-orange-50",
                        ].join(" ")}
                      >
                        <span>{emoji}</span>
                        {voters.length > 0 && (
                          <span
                            data-testid={`ht-react-count-${take.id}-${emoji}`}
                            className="text-xs text-gray-600"
                          >
                            {voters.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
