import React from "react";

export interface DrawCard {
  cardId: string;
  label: string;
  emoji: string;
  description?: string;
}

export interface CardDrawConfig {
  title: string;
  cards: DrawCard[];
  allowReveal: boolean;
}

export interface PlayerDraw {
  userId: string;
  userName: string;
  cardId: string;
}

export interface CardDrawState extends Record<string, unknown> {
  draws: PlayerDraw[];
  revealed: boolean;
}

interface Props {
  config: CardDrawConfig;
  state: CardDrawState;
  myUserId: string;
  onDraw: () => void;
  onReveal: () => void;
}

export default function CardDraw({ config, state, myUserId, onDraw, onReveal }: Props) {
  const { title, cards, allowReveal } = config;
  const { draws, revealed } = state;

  const myDraw = draws.find((d) => d.userId === myUserId);
  const myCard = myDraw ? cards.find((c) => c.cardId === myDraw.cardId) : null;
  const hasDrawn = !!myDraw;

  return (
    <div data-testid="cd-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto text-center">
      <h2 data-testid="cd-title" className="text-lg font-bold">{title}</h2>

      {/* 尚未抽牌 */}
      {!hasDrawn && (
        <button
          data-testid="cd-draw-btn"
          onClick={onDraw}
          className="py-8 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl font-bold hover:from-purple-600 hover:to-pink-600 active:scale-95 transition-all shadow-lg"
        >
          🎴 抽牌
        </button>
      )}

      {/* 我的牌 */}
      {hasDrawn && myCard && (
        <div data-testid="cd-my-card" className="rounded-2xl border-4 border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 p-6 shadow-xl">
          <div data-testid="cd-my-emoji" className="text-5xl mb-2">{myCard.emoji}</div>
          <p data-testid="cd-my-label" className="text-lg font-bold text-purple-700">{myCard.label}</p>
          {myCard.description && (
            <p data-testid="cd-my-desc" className="text-sm text-gray-500 mt-2">{myCard.description}</p>
          )}
        </div>
      )}

      {/* 等待揭曉 */}
      {hasDrawn && !revealed && (
        <p data-testid="cd-waiting-msg" className="text-sm text-gray-400">
          等待主持人揭曉所有人的牌…
        </p>
      )}

      {/* 揭曉按鈕 */}
      {allowReveal && !revealed && (
        <button
          data-testid="cd-reveal-btn"
          onClick={onReveal}
          className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
        >
          揭曉所有人的牌
        </button>
      )}

      {/* 揭曉後顯示所有人的牌 */}
      {revealed && (
        <div data-testid="cd-all-draws" className="flex flex-col gap-3">
          <p className="text-sm text-purple-600 font-semibold">🎴 所有人的牌</p>
          {draws.length === 0 ? (
            <p data-testid="cd-empty" className="text-center text-gray-400 text-sm py-4">還沒有人抽牌</p>
          ) : (
            draws.map((draw) => {
              const card = cards.find((c) => c.cardId === draw.cardId);
              return (
                <div
                  key={draw.userId}
                  data-testid={`cd-draw-${draw.userId}`}
                  className={[
                    "flex items-center gap-3 rounded-xl border p-3",
                    draw.userId === myUserId
                      ? "border-purple-400 bg-purple-50"
                      : "border-gray-200 bg-white",
                  ].join(" ")}
                >
                  <span data-testid={`cd-draw-emoji-${draw.userId}`} className="text-2xl">
                    {card?.emoji ?? "❓"}
                  </span>
                  <div className="flex-1 text-left">
                    <p className="text-xs text-gray-500">{draw.userName}</p>
                    <p data-testid={`cd-draw-label-${draw.userId}`} className="text-sm font-semibold">
                      {card?.label ?? "未知"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="text-xs text-gray-400">
        <span data-testid="cd-count">{draws.length}</span> 人已抽牌
        {cards.length > 0 && (
          <span> / 共 <span data-testid="cd-total-cards">{cards.length}</span> 種牌</span>
        )}
      </div>
    </div>
  );
}
