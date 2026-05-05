import { useMemo } from "react";

export interface EmojiBattleConfig {
  title: string;
  question: string;
  emojis: { emoji: string; label: string }[];
  allowMultiSelect: boolean;
  showResults: boolean;
}

export interface EmojiVote {
  userId: string;
  userName: string;
  emojis: string[];
  votedAt: number;
}

export interface EmojiBattleState extends Record<string, unknown> {
  votes: EmojiVote[];
}

interface Props {
  config: EmojiBattleConfig;
  state: EmojiBattleState;
  myUserId: string;
  onSelect: (emoji: string) => void;
}

export default function EmojiBattle({ config, state, myUserId, onSelect }: Props) {
  const { title, question, emojis, allowMultiSelect, showResults } = config;
  const { votes } = state;

  const myVote = votes.find((v) => v.userId === myUserId);
  const myEmojis = myVote?.emojis ?? [];
  const totalVoters = votes.length;

  const emojiCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const vote of votes) {
      for (const em of vote.emojis) {
        counts[em] = (counts[em] ?? 0) + 1;
      }
    }
    return counts;
  }, [votes]);

  const maxCount = Math.max(...Object.values(emojiCounts), 1);
  const topEmoji = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 flex flex-col px-4 py-6 gap-4" data-testid="emoji-battle-root">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800" data-testid="eb-title">{title}</h1>
        <p className="text-lg text-gray-600 mt-2 font-medium" data-testid="eb-question">{question}</p>
      </div>

      {/* Stats */}
      <div className="text-center text-sm text-gray-400">
        <span data-testid="eb-voter-count">{totalVoters}</span> 人已選擇
      </div>

      {/* Emoji grid */}
      <div className="grid grid-cols-3 gap-3" data-testid="eb-emoji-grid">
        {emojis.map(({ emoji, label }) => {
          const isSelected = myEmojis.includes(emoji);
          const count = emojiCounts[emoji] ?? 0;
          const barPct = Math.round((count / maxCount) * 100);
          const isTop = showResults && emoji === topEmoji && totalVoters > 0;

          return (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              className={`relative flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${
                isSelected
                  ? "bg-orange-100 ring-2 ring-orange-400 scale-105"
                  : "bg-white hover:bg-orange-50"
              } shadow ${isTop ? "ring-2 ring-yellow-400" : ""}`}
              data-testid={`eb-emoji-btn-${emoji}`}
            >
              <span className="text-4xl" data-testid={`eb-emoji-icon-${emoji}`}>{emoji}</span>
              <span className="text-xs text-gray-500">{label}</span>

              {showResults && (
                <>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-orange-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${barPct}%` }}
                      data-testid={`eb-bar-${emoji}`}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-600" data-testid={`eb-count-${emoji}`}>
                    {count}
                  </span>
                </>
              )}

              {isSelected && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-orange-400 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* My selection */}
      {myEmojis.length > 0 ? (
        <div className="text-center text-sm text-orange-600 font-medium" data-testid="eb-my-selection">
          你選了：{myEmojis.join(" ")}
          {allowMultiSelect && <span className="text-gray-400 text-xs ml-1">（可多選）</span>}
        </div>
      ) : (
        <div className="text-center text-gray-400 text-sm" data-testid="eb-no-selection">
          點選上方 emoji 表達你的感受！
        </div>
      )}

      {/* Top emoji announcement */}
      {showResults && topEmoji && totalVoters > 0 && (
        <div className="text-center bg-yellow-50 rounded-2xl py-3 px-4" data-testid="eb-top-result">
          <span className="text-2xl">{topEmoji}</span>
          <span className="text-sm text-gray-600 ml-2">
            最多人選 ({emojiCounts[topEmoji]} 票)
          </span>
        </div>
      )}
    </div>
  );
}
