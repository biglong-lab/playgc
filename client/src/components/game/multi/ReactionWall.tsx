import React from "react";

export interface ReactionWallConfig extends Record<string, unknown> {
  title: string;
  content: string;
  emojis: string[];
  showNames: boolean;
}

export interface Reaction extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  emoji: string;
}

export interface ReactionWallState extends Record<string, unknown> {
  reactions: Reaction[];
}

interface Props {
  config: ReactionWallConfig;
  state: ReactionWallState;
  myUserId: string;
  onReact: (emoji: string) => void;
}

export default function ReactionWall({ config, state, myUserId, onReact }: Props) {
  const { title, content, emojis, showNames } = config;
  const { reactions } = state;

  const myReaction = reactions.find((r) => r.userId === myUserId);
  const total = reactions.length;

  const countFor = (emoji: string) => reactions.filter((r) => r.emoji === emoji).length;

  return (
    <div data-testid="rw-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="rw-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <div
        data-testid="rw-content"
        className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center text-gray-800"
      >
        {content}
      </div>

      <div data-testid="rw-total-count" className="text-center text-sm text-gray-500">
        共 <span className="font-semibold text-indigo-600">{total}</span> 人回應
      </div>

      <div className="grid grid-cols-3 gap-3">
        {emojis.map((emoji, idx) => {
          const count = countFor(emoji);
          const isMyPick = myReaction?.emoji === emoji;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <button
              key={emoji}
              data-testid={`rw-emoji-btn-${idx}`}
              onClick={() => onReact(emoji)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition ${
                isMyPick
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50"
              }`}
            >
              <span className="text-3xl">{emoji}</span>
              <span data-testid={`rw-count-${idx}`} className="text-sm font-semibold text-gray-700">
                {count}
              </span>
              {total > 0 && (
                <div className="w-full bg-gray-100 rounded-full h-1">
                  <div
                    className="bg-indigo-400 h-1 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {myReaction && (
        <div data-testid="rw-my-reaction" className="text-center text-sm text-green-600">
          你選了 {myReaction.emoji}
        </div>
      )}

      {showNames && reactions.length > 0 && (
        <div className="flex flex-col gap-1">
          {emojis.map((emoji, idx) => {
            const names = reactions.filter((r) => r.emoji === emoji).map((r) => r.userName);
            if (names.length === 0) return null;
            return (
              <div key={emoji} data-testid={`rw-names-${idx}`} className="text-xs text-gray-500 text-center">
                {emoji} {names.join(", ")}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
