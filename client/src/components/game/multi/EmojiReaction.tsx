import { useState } from "react";

export interface Reaction extends Record<string, unknown> {
  reactionId: string;
  userId: string;
  userName: string;
  emoji: string;
  note: string;
}

export interface EmojiReactionConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxNote: number;
}

export interface EmojiReactionState extends Record<string, unknown> {
  reactions: Reaction[];
  revealed: boolean;
}

const EMOJI_OPTIONS = ["😄", "🤩", "😌", "🤔", "😬", "😤", "😢", "😴", "🔥", "💡"];

const DEFAULT_CONFIG: EmojiReactionConfig = {
  title: "Emoji 情緒反應",
  prompt: "用一個 Emoji 表達你現在的感受",
  maxNote: 30,
};

interface Props {
  config: EmojiReactionConfig;
  state: EmojiReactionState;
  myUserId: string;
  onSubmit: (emoji: string, note: string) => void;
  onReveal: () => void;
}

export default function EmojiReaction({ config, state, myUserId, onSubmit, onReveal }: Props) {
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const { title, prompt, maxNote } = config || DEFAULT_CONFIG;
  const { reactions, revealed } = state;

  const myReaction = reactions.find((r) => r.userId === myUserId);

  function handleSubmit() {
    if (!selectedEmoji) return;
    onSubmit(selectedEmoji, note.trim());
    setSelectedEmoji(null);
    setNote("");
  }

  const emojiGroups = revealed
    ? EMOJI_OPTIONS.reduce<Record<string, Reaction[]>>((acc, e) => {
        const group = reactions.filter((r) => r.emoji === e);
        if (group.length > 0) acc[e] = group;
        return acc;
      }, {})
    : {};

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="er-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p
        data-testid="er-prompt"
        className="text-base text-center p-4 bg-pink-50 rounded-xl font-medium text-pink-800"
      >
        {prompt}
      </p>

      {!revealed && (
        <div className="space-y-4">
          {!myReaction ? (
            <div className="space-y-3">
              <div
                data-testid="er-emoji-grid"
                className="grid grid-cols-5 gap-2"
              >
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    data-testid={`er-emoji-${e}`}
                    onClick={() => setSelectedEmoji(e)}
                    className={`text-2xl p-2 rounded-xl border-2 transition-all ${
                      selectedEmoji === e
                        ? "border-pink-400 bg-pink-50 scale-110"
                        : "border-gray-200 hover:border-pink-200"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>

              {selectedEmoji && (
                <div className="space-y-2">
                  <input
                    data-testid="er-note-input"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, maxNote))}
                    placeholder="補充一句話（可略）"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      {note.length}/{maxNote}
                    </span>
                    <button
                      data-testid="er-submit-btn"
                      onClick={handleSubmit}
                      className="px-6 py-2 bg-pink-500 text-white rounded-lg text-sm font-semibold hover:bg-pink-600"
                    >
                      送出 {selectedEmoji}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p data-testid="er-submitted" className="text-center text-sm text-gray-500">
              ✅ 已送出 {myReaction.emoji}
              {myReaction.note ? `「${myReaction.note}」` : ""}
            </p>
          )}

          <p className="text-xs text-center text-gray-400">
            已有 <span data-testid="er-count">{reactions.length}</span> 人回應
          </p>

          <div className="text-center">
            <button
              data-testid="er-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布所有回應
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div data-testid="er-result" className="space-y-3">
          {reactions.length === 0 ? (
            <div data-testid="er-empty" className="text-center text-gray-400 py-8">
              尚無人回應
            </div>
          ) : (
            Object.entries(emojiGroups).map(([emoji, group]) => (
              <div
                key={emoji}
                data-testid={`er-group-${emoji}`}
                className="p-3 bg-white border border-gray-100 rounded-xl space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-sm font-semibold text-gray-700">
                    {group.length} 人
                  </span>
                </div>
                {group.map((r) => (
                  <div
                    key={r.reactionId}
                    data-testid={`er-reaction-${r.reactionId}`}
                    className="pl-3 text-xs text-gray-600"
                  >
                    <span className="font-medium text-gray-800">{r.userName}</span>
                    {r.note ? ` — ${r.note}` : ""}
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
