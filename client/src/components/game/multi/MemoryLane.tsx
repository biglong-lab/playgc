import React from "react";

export interface MemoryLaneConfig extends Record<string, unknown> {
  title: string;
  question: string;
  maxLength: number;
  showAuthor: boolean;
}

export interface MemoryCard extends Record<string, unknown> {
  memId: string;
  userId: string;
  userName: string;
  text: string;
  hearts: string[];
}

export interface MemoryLaneState extends Record<string, unknown> {
  memories: MemoryCard[];
  revealed: boolean;
}

interface Props {
  config: MemoryLaneConfig;
  state: MemoryLaneState;
  myUserId: string;
  draftText: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
  onHeart: (memId: string) => void;
}

export default function MemoryLane({
  config,
  state,
  myUserId,
  draftText,
  onDraftChange,
  onSubmit,
  onReveal,
  onHeart,
}: Props) {
  const { title, question, maxLength, showAuthor } = config;
  const { memories, revealed } = state;

  const myMemory = memories.find((m) => m.userId === myUserId);
  const isOver = draftText.length > maxLength;
  const canSubmit = draftText.trim().length > 0 && !isOver && !myMemory;

  return (
    <div data-testid="ml-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="ml-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p data-testid="ml-question" className="text-sm text-center text-gray-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
        💭 {question}
      </p>

      <div data-testid="ml-count" className="text-center text-sm text-gray-500">
        <span className="font-semibold text-rose-500">{memories.length}</span> 則回憶已分享
      </div>

      {!myMemory && !revealed && (
        <div className="flex flex-col gap-2">
          <textarea
            data-testid="ml-input"
            value={draftText}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="寫下你的回憶…"
            rows={4}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-300"
          />
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span data-testid="ml-char-count">{draftText.length} / {maxLength}</span>
            {isOver && (
              <span data-testid="ml-error" className="text-red-500">超過字數限制</span>
            )}
          </div>
          <button
            data-testid="ml-submit-btn"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="w-full py-3 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            分享回憶
          </button>
        </div>
      )}

      {myMemory && !revealed && (
        <div data-testid="ml-submitted-msg" className="p-3 bg-green-50 rounded-xl border border-green-200 text-center text-green-700 font-semibold">
          ✅ 回憶已分享！等待揭曉
        </div>
      )}

      {!revealed ? (
        <button
          data-testid="ml-reveal-btn"
          onClick={onReveal}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
        >
          揭曉所有回憶
        </button>
      ) : (
        <div data-testid="ml-result" className="flex flex-col gap-3">
          {memories.length === 0 ? (
            <div data-testid="ml-empty" className="text-center text-gray-400 p-8">
              還沒有人分享回憶
            </div>
          ) : (
            memories.map((mem) => {
              const hearted = mem.hearts.includes(myUserId);
              return (
                <div
                  key={mem.memId}
                  data-testid={`ml-card-${mem.memId}`}
                  className="p-4 bg-white rounded-xl border border-rose-100 shadow-sm"
                >
                  {showAuthor && (
                    <div className="text-xs text-rose-400 font-semibold mb-2">
                      {mem.userName}
                    </div>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed">{mem.text}</p>
                  <div className="flex items-center justify-end mt-2">
                    <button
                      data-testid={`ml-heart-${mem.memId}`}
                      onClick={() => onHeart(mem.memId)}
                      className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full transition-colors ${
                        hearted
                          ? "bg-rose-100 text-rose-600"
                          : "text-gray-400 hover:text-rose-400 hover:bg-rose-50"
                      }`}
                    >
                      {hearted ? "❤️" : "🤍"}
                      <span data-testid={`ml-heart-count-${mem.memId}`}>
                        {mem.hearts.length}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
