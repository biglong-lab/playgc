import { useMemo, useState } from "react";
import { Heart, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface PeerRecognitionConfig {
  title: string;
  prompt?: string;
  placeholder?: string;
  maxLength: number;
  allowAnonymous: boolean;
  emojiOptions: string[];
}

export interface RecognitionCard {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toName: string;
  message: string;
  emoji: string;
  hearts: string[];
  addedAt: number;
  anonymous: boolean;
}

export interface PeerRecognitionState extends Record<string, unknown> {
  cards: RecognitionCard[];
}

interface Props {
  config: PeerRecognitionConfig;
  state: PeerRecognitionState;
  myUserId: string;
  draftTo: string;
  draftMessage: string;
  draftEmoji: string;
  draftAnonymous: boolean;
  onToChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onEmojiChange: (v: string) => void;
  onAnonymousChange: (v: boolean) => void;
  onSubmit: () => void;
  onHeart: (cardId: string) => void;
}

const DEFAULT_EMOJIS = ["🌟", "🙌", "💪", "❤️", "👏", "🎉", "🔥", "💡", "🤝", "✨"];

export default function PeerRecognition({
  config,
  state,
  myUserId,
  draftTo,
  draftMessage,
  draftEmoji,
  draftAnonymous,
  onToChange,
  onMessageChange,
  onEmojiChange,
  onAnonymousChange,
  onSubmit,
  onHeart,
}: Props) {
  const {
    title,
    prompt = "寫下你想感謝的人",
    placeholder = "感謝你在這次活動中…",
    maxLength,
    allowAnonymous,
    emojiOptions = DEFAULT_EMOJIS,
  } = config;

  const { cards } = state;
  const [showForm, setShowForm] = useState(true);

  const hasSubmitted = cards.some((c) => c.fromUserId === myUserId);
  const canSubmit = draftTo.trim().length > 0 && draftMessage.trim().length > 0 && draftEmoji !== "";
  const remaining = maxLength - draftMessage.length;

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => b.hearts.length - a.hearts.length || a.addedAt - b.addedAt),
    [cards],
  );

  const handleSubmit = () => {
    onSubmit();
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-6 gap-5" data-testid="peer-recognition-root">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800" data-testid="recognition-title">{title}</h1>
        <p className="text-gray-500 mt-1 text-sm" data-testid="recognition-prompt">{prompt}</p>
      </div>

      {/* Stats */}
      <div className="text-center text-sm text-gray-400" data-testid="card-count">
        已有 <span className="font-bold text-gray-700">{cards.length}</span> 則感謝
      </div>

      {/* Form */}
      {!hasSubmitted && showForm && (
        <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3" data-testid="recognition-form">
          {/* To field */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">感謝對象</label>
            <input
              value={draftTo}
              onChange={(e) => onToChange(e.target.value)}
              placeholder="輸入對方的名字"
              maxLength={30}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              data-testid="to-input"
            />
          </div>

          {/* Emoji picker */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">選個 emoji</label>
            <div className="flex flex-wrap gap-2">
              {emojiOptions.map((em) => (
                <button
                  key={em}
                  onClick={() => onEmojiChange(em)}
                  className={`text-2xl p-1 rounded-lg transition-all ${
                    draftEmoji === em ? "bg-pink-100 ring-2 ring-pink-400 scale-110" : "hover:bg-gray-100"
                  }`}
                  data-testid={`emoji-btn-${em}`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <Textarea
              value={draftMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder={placeholder}
              maxLength={maxLength}
              rows={3}
              className="resize-none"
              data-testid="message-input"
            />
            <div className={`text-xs text-right mt-1 ${remaining < 10 ? "text-red-500" : "text-gray-400"}`}>
              {remaining} 字
            </div>
          </div>

          {/* Anonymous toggle */}
          {allowAnonymous && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={draftAnonymous}
                onChange={(e) => onAnonymousChange(e.target.checked)}
                data-testid="anonymous-toggle"
              />
              匿名送出
            </label>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-pink-500 hover:bg-pink-600 text-white"
            data-testid="submit-recognition-btn"
          >
            <Send className="w-4 h-4 mr-2" />
            送出感謝
          </Button>
        </div>
      )}

      {/* Already submitted notice */}
      {hasSubmitted && !showForm && (
        <div className="text-center text-sm text-pink-500 font-medium" data-testid="submitted-msg">
          感謝已送出！❤️
        </div>
      )}

      {/* Add another button */}
      {hasSubmitted && (
        <Button
          variant="outline"
          onClick={() => setShowForm(true)}
          className="self-center text-sm"
          data-testid="add-another-btn"
        >
          再感謝一位
        </Button>
      )}

      {/* Cards */}
      {cards.length === 0 ? (
        <div className="text-center text-gray-400 py-8" data-testid="empty-cards">
          還沒有感謝，第一個送出吧！
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="card-list">
          {sortedCards.map((card) => {
            const hasHearted = card.hearts.includes(myUserId);
            return (
              <div
                key={card.id}
                className="bg-white rounded-2xl shadow p-4"
                data-testid={`card-${card.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" data-testid={`card-emoji-${card.id}`}>{card.emoji}</span>
                    <div>
                      <span className="font-bold text-gray-800" data-testid={`card-to-${card.id}`}>
                        給 {card.toName}
                      </span>
                      <div className="text-xs text-gray-400" data-testid={`card-from-${card.id}`}>
                        來自 {card.anonymous ? "匿名" : card.fromUserName}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onHeart(card.id)}
                    disabled={card.fromUserId === myUserId}
                    className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full transition-colors ${
                      hasHearted
                        ? "text-pink-500 bg-pink-50"
                        : "text-gray-400 hover:text-pink-400"
                    } disabled:opacity-40 disabled:cursor-default`}
                    data-testid={`heart-btn-${card.id}`}
                  >
                    <Heart className={`w-4 h-4 ${hasHearted ? "fill-pink-500" : ""}`} />
                    <span data-testid={`heart-count-${card.id}`}>{card.hearts.length}</span>
                  </button>
                </div>
                <p className="text-gray-700 text-sm mt-2" data-testid={`card-message-${card.id}`}>
                  {card.message}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
