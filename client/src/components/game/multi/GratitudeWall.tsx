import { Heart, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface GratitudeWallConfig {
  title: string;
  prompt?: string;
  placeholder?: string;
  maxLength: number;
  maxCardsPerPerson: number;
  showAuthor: boolean;
  cardColors: string[];
}

export interface GratitudeCard {
  id: string;
  userId: string;
  userName: string;
  text: string;
  emoji: string;
  color: string;
  hearts: string[];
  addedAt: number;
}

export interface GratitudeWallState extends Record<string, unknown> {
  cards: GratitudeCard[];
}

interface Props {
  config: GratitudeWallConfig;
  state: GratitudeWallState;
  myUserId: string;
  draftText: string;
  draftEmoji: string;
  onTextChange: (v: string) => void;
  onEmojiChange: (v: string) => void;
  onAdd: () => void;
  onHeart: (cardId: string) => void;
}

const DEFAULT_COLORS = ["bg-yellow-100", "bg-pink-100", "bg-blue-100", "bg-green-100", "bg-purple-100", "bg-orange-100"];
const QUICK_EMOJIS = ["🙏", "❤️", "💖", "🌟", "😊", "🎉", "👏", "💐"];

export default function GratitudeWall({
  config,
  state,
  myUserId,
  draftText,
  draftEmoji,
  onTextChange,
  onEmojiChange,
  onAdd,
  onHeart,
}: Props) {
  const {
    title,
    prompt = "寫下你的感謝！",
    placeholder = "感謝…",
    maxLength,
    maxCardsPerPerson,
    showAuthor,
    cardColors = DEFAULT_COLORS,
  } = config;

  const { cards } = state;

  const myCount = cards.filter((c) => c.userId === myUserId).length;
  const canAdd = myCount < maxCardsPerPerson && draftText.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 flex flex-col px-4 py-6 gap-4" data-testid="gratitude-wall-root">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2" data-testid="gw-title">
          <Heart className="w-6 h-6 text-rose-500" />
          {title}
        </h1>
        <p className="text-gray-500 text-sm mt-1" data-testid="gw-prompt">{prompt}</p>
      </div>

      {/* Stats */}
      <div className="text-center text-sm text-gray-400">
        <span data-testid="gw-card-count">{cards.length}</span> 張感謝卡 · 我寫了{" "}
        <span data-testid="gw-my-count">{myCount}</span>/{maxCardsPerPerson}
      </div>

      {/* Add form */}
      {myCount < maxCardsPerPerson ? (
        <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3" data-testid="gw-add-form">
          {/* Emoji selector */}
          <div className="flex gap-2 flex-wrap">
            {QUICK_EMOJIS.map((em) => (
              <button
                key={em}
                onClick={() => onEmojiChange(em)}
                className={`text-xl p-1.5 rounded-lg transition-all ${
                  draftEmoji === em ? "bg-pink-100 ring-2 ring-pink-400 scale-110" : "hover:bg-gray-100"
                }`}
                data-testid={`gw-emoji-${em}`}
              >
                {em}
              </button>
            ))}
          </div>

          <Textarea
            value={draftText}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={3}
            className="resize-none"
            data-testid="gw-text-input"
          />

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{maxLength - draftText.length} 字</span>
            <Button
              onClick={onAdd}
              disabled={!canAdd}
              className="bg-rose-500 hover:bg-rose-600 text-white"
              data-testid="gw-add-btn"
            >
              <Send className="w-4 h-4 mr-1" />
              送出
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center text-sm text-gray-400 bg-white rounded-xl py-3" data-testid="gw-max-reached">
          已寫滿感謝卡
        </div>
      )}

      {/* Cards */}
      {cards.length === 0 ? (
        <div className="text-center text-gray-400 py-8" data-testid="gw-empty">
          還沒有感謝卡，第一個分享吧！
        </div>
      ) : (
        <div className="columns-2 gap-3 space-y-3" data-testid="gw-card-list">
          {cards.map((card, i) => {
            const isOwn = card.userId === myUserId;
            const hasHearted = card.hearts.includes(myUserId);
            const colorClass = cardColors[i % cardColors.length] ?? "bg-yellow-100";

            return (
              <div
                key={card.id}
                className={`${colorClass} rounded-2xl p-3 break-inside-avoid`}
                data-testid={`gw-card-${card.id}`}
              >
                {card.emoji && (
                  <div className="text-2xl mb-1" data-testid={`gw-card-emoji-${card.id}`}>{card.emoji}</div>
                )}
                <p className="text-gray-800 text-sm leading-relaxed" data-testid={`gw-card-text-${card.id}`}>
                  {card.text}
                </p>
                {showAuthor && (
                  <p className="text-xs text-gray-500 mt-1" data-testid={`gw-card-author-${card.id}`}>
                    — {isOwn ? "我" : card.userName}
                  </p>
                )}
                <button
                  onClick={() => onHeart(card.id)}
                  className={`flex items-center gap-1 mt-2 text-xs rounded-full px-2 py-0.5 transition-colors ${
                    hasHearted ? "text-rose-500 bg-rose-50" : "text-gray-400 hover:text-rose-400"
                  }`}
                  data-testid={`gw-heart-btn-${card.id}`}
                >
                  <Heart className={`w-3 h-3 ${hasHearted ? "fill-rose-500" : ""}`} />
                  <span data-testid={`gw-heart-count-${card.id}`}>{card.hearts.length}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
