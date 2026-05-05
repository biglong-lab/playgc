import React, { useState } from "react";

export interface EmojiStoryConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  emojiOptions: string[];
  maxEmojis: number;
  captionMaxLength: number;
  showAuthor: boolean;
}

export interface Story extends Record<string, unknown> {
  storyId: string;
  userId: string;
  userName: string;
  emojis: string[];
  caption: string;
  hearts: string[];
}

export interface EmojiStoryState extends Record<string, unknown> {
  stories: Story[];
  revealed: boolean;
}

const DEFAULT_EMOJIS = [
  "😊","😂","🥰","😎","🤩","😴","🤔","😤","🥳","🤗",
  "👍","🙌","💪","❤️","🔥","⭐","🎉","🎊","🎈","🌈",
  "🍕","🍜","🍦","🎮","🎵","🏆","✈️","🌸","🌊","⚽",
];

interface Props {
  config: EmojiStoryConfig;
  state: EmojiStoryState;
  myUserId: string;
  onSubmit: (emojis: string[], caption: string) => void;
  onReveal: () => void;
  onHeart: (storyId: string) => void;
}

export default function EmojiStory({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
  onHeart,
}: Props) {
  const { title, prompt, emojiOptions, maxEmojis, captionMaxLength, showAuthor } = config;
  const { stories, revealed } = state;

  const [selected, setSelected] = useState<string[]>([]);
  const [caption, setCaption] = useState("");

  const myStory = stories.find((s) => s.userId === myUserId);
  const emojis = emojiOptions.length > 0 ? emojiOptions : DEFAULT_EMOJIS;
  const canSubmit = selected.length === maxEmojis && !myStory && caption.length <= captionMaxLength;

  function toggleEmoji(emoji: string) {
    setSelected((prev) => {
      if (prev.includes(emoji)) return prev.filter((e) => e !== emoji);
      if (prev.length >= maxEmojis) return [...prev.slice(1), emoji];
      return [...prev, emoji];
    });
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(selected, caption.trim());
    setSelected([]);
    setCaption("");
  }

  return (
    <div data-testid="es-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="es-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p data-testid="es-prompt" className="text-sm text-center text-gray-600 bg-yellow-50 p-3 rounded-xl border border-yellow-100">
        {prompt}
      </p>

      <div data-testid="es-count" className="text-center text-sm text-gray-500">
        <span className="font-semibold text-yellow-600">{stories.length}</span> 人已創作
      </div>

      {!myStory && !revealed && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1 text-center">
              已選 <span className="font-bold text-yellow-600">{selected.length}</span> / {maxEmojis} 個 emoji
            </p>
            <div data-testid="es-selected" className="flex justify-center gap-1 h-10 items-center bg-gray-50 rounded-xl border border-gray-200">
              {selected.length === 0 ? (
                <span className="text-xs text-gray-400">點選下方 emoji</span>
              ) : (
                selected.map((e, i) => (
                  <button
                    key={i}
                    data-testid={`es-selected-emoji-${i}`}
                    onClick={() => toggleEmoji(e)}
                    className="text-2xl hover:scale-110 transition-transform"
                  >
                    {e}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-10 gap-1">
            {emojis.map((emoji) => {
              const isSelected = selected.includes(emoji);
              return (
                <button
                  key={emoji}
                  data-testid={`es-emoji-btn-${emoji}`}
                  onClick={() => toggleEmoji(emoji)}
                  className={`text-xl p-1 rounded-lg transition-all ${
                    isSelected ? "bg-yellow-200 scale-110" : "hover:bg-gray-100"
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1">
            <input
              data-testid="es-caption-input"
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="（選填）加一句話說明…"
              maxLength={captionMaxLength + 5}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
            />
            {caption.length > captionMaxLength && (
              <p data-testid="es-caption-error" className="text-xs text-red-500 text-center">
                說明最多 {captionMaxLength} 字
              </p>
            )}
          </div>

          <button
            data-testid="es-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 bg-yellow-500 text-white font-bold rounded-xl hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送出我的 Emoji 故事
          </button>
        </div>
      )}

      {myStory && !revealed && (
        <div data-testid="es-submitted-msg" className="p-3 bg-green-50 rounded-xl border border-green-200 text-center">
          <div className="text-2xl mb-1">{myStory.emojis.join(" ")}</div>
          {myStory.caption && <p className="text-sm text-gray-600">{myStory.caption}</p>}
          <p className="text-green-700 font-semibold text-sm mt-1">✅ 已送出！等待揭曉</p>
        </div>
      )}

      {!revealed ? (
        <button
          data-testid="es-reveal-btn"
          onClick={onReveal}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
        >
          揭曉所有 Emoji 故事
        </button>
      ) : (
        <div data-testid="es-result" className="flex flex-col gap-3">
          {stories.length === 0 ? (
            <div data-testid="es-empty" className="text-center text-gray-400 p-8">
              還沒有人創作
            </div>
          ) : (
            stories.map((story) => {
              const hearted = story.hearts.includes(myUserId);
              return (
                <div
                  key={story.storyId}
                  data-testid={`es-story-${story.storyId}`}
                  className="p-4 bg-white rounded-xl border border-yellow-100 shadow-sm"
                >
                  {showAuthor && (
                    <p className="text-xs text-yellow-500 font-semibold mb-1">{story.userName}</p>
                  )}
                  <div
                    data-testid={`es-story-emojis-${story.storyId}`}
                    className="text-3xl mb-1"
                  >
                    {story.emojis.join(" ")}
                  </div>
                  {story.caption && (
                    <p
                      data-testid={`es-story-caption-${story.storyId}`}
                      className="text-sm text-gray-600"
                    >
                      {story.caption}
                    </p>
                  )}
                  <div className="flex justify-end mt-2">
                    <button
                      data-testid={`es-heart-${story.storyId}`}
                      onClick={() => onHeart(story.storyId)}
                      className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full ${
                        hearted ? "text-rose-600 bg-rose-50" : "text-gray-400 hover:text-rose-400"
                      }`}
                    >
                      {hearted ? "❤️" : "🤍"}
                      <span data-testid={`es-heart-count-${story.storyId}`}>
                        {story.hearts.length}
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
