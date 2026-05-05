import React, { useState } from "react";

export interface SkillSwapConfig extends Record<string, unknown> {
  title: string;
  offerPrompt: string;
  wantPrompt: string;
  maxLength: number;
  showAuthor: boolean;
}

export interface SkillCard extends Record<string, unknown> {
  cardId: string;
  userId: string;
  userName: string;
  offerSkill: string;
  wantSkill: string;
  hearts: string[];
}

export interface SkillSwapState extends Record<string, unknown> {
  cards: SkillCard[];
  revealed: boolean;
}

interface Props {
  config: SkillSwapConfig;
  state: SkillSwapState;
  myUserId: string;
  onSubmit: (offerSkill: string, wantSkill: string) => void;
  onReveal: () => void;
  onHeart: (cardId: string) => void;
}

export default function SkillSwap({ config, state, myUserId, onSubmit, onReveal, onHeart }: Props) {
  const { title, offerPrompt, wantPrompt, maxLength, showAuthor } = config;
  const { cards, revealed } = state;

  const myCard = cards.find((c) => c.userId === myUserId);
  const [offerDraft, setOfferDraft] = useState("");
  const [wantDraft, setWantDraft] = useState("");

  const canSubmit =
    offerDraft.trim().length > 0 &&
    wantDraft.trim().length > 0 &&
    offerDraft.length <= maxLength &&
    wantDraft.length <= maxLength &&
    !myCard;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(offerDraft.trim(), wantDraft.trim());
    setOfferDraft("");
    setWantDraft("");
  }

  function getMatchInfo(card: SkillCard): string[] {
    const offer = card.offerSkill.toLowerCase();
    const want = card.wantSkill.toLowerCase();
    const matches: string[] = [];
    cards.forEach((other) => {
      if (other.cardId === card.cardId) return;
      if (other.wantSkill.toLowerCase() === offer) matches.push(other.userName);
      if (other.offerSkill.toLowerCase() === want) matches.push(other.userName);
    });
    return Array.from(new Set(matches));
  }

  return (
    <div data-testid="ss-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="ss-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <div data-testid="ss-count" className="text-center text-sm text-gray-500">
        <span className="font-semibold text-teal-600">{cards.length}</span> 張技能卡
      </div>

      {!myCard && !revealed && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-teal-700">{offerPrompt}</label>
            <input
              data-testid="ss-offer-input"
              type="text"
              value={offerDraft}
              onChange={(e) => setOfferDraft(e.target.value)}
              placeholder="我能提供的技能…"
              maxLength={maxLength + 5}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
            {offerDraft.length > maxLength && (
              <p data-testid="ss-offer-error" className="text-xs text-red-500">
                最多 {maxLength} 字
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-amber-700">{wantPrompt}</label>
            <input
              data-testid="ss-want-input"
              type="text"
              value={wantDraft}
              onChange={(e) => setWantDraft(e.target.value)}
              placeholder="我想學的技能…"
              maxLength={maxLength + 5}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            {wantDraft.length > maxLength && (
              <p data-testid="ss-want-error" className="text-xs text-red-500">
                最多 {maxLength} 字
              </p>
            )}
          </div>

          <button
            data-testid="ss-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 bg-teal-500 text-white font-bold rounded-xl hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送出我的技能卡
          </button>
        </div>
      )}

      {myCard && !revealed && (
        <div data-testid="ss-submitted-msg" className="p-3 bg-green-50 rounded-xl border border-green-200 text-center">
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-teal-700">提供：</span>{myCard.offerSkill}
          </p>
          <p className="text-sm text-gray-700 mt-1">
            <span className="font-semibold text-amber-700">想學：</span>{myCard.wantSkill}
          </p>
          <p className="text-green-700 font-semibold text-sm mt-2">✅ 已送出！等待揭曉</p>
        </div>
      )}

      {!revealed ? (
        <button
          data-testid="ss-reveal-btn"
          onClick={onReveal}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
        >
          揭曉技能交換牆
        </button>
      ) : (
        <div data-testid="ss-result" className="flex flex-col gap-3">
          {cards.length === 0 ? (
            <div data-testid="ss-empty" className="text-center text-gray-400 p-8">
              還沒有人填寫
            </div>
          ) : (
            cards.map((card) => {
              const hearted = card.hearts.includes(myUserId);
              const matches = getMatchInfo(card);
              return (
                <div
                  key={card.cardId}
                  data-testid={`ss-card-${card.cardId}`}
                  className="p-4 bg-white rounded-xl border border-teal-100 shadow-sm"
                >
                  {showAuthor && (
                    <p className="text-xs text-teal-500 font-semibold mb-1">{card.userName}</p>
                  )}
                  <div className="flex gap-3 text-sm">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-teal-700 mb-0.5">我能提供</p>
                      <p
                        data-testid={`ss-card-offer-${card.cardId}`}
                        className="font-semibold text-gray-700"
                      >
                        {card.offerSkill}
                      </p>
                    </div>
                    <div className="w-px bg-gray-200" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-amber-700 mb-0.5">我想學</p>
                      <p
                        data-testid={`ss-card-want-${card.cardId}`}
                        className="font-semibold text-gray-700"
                      >
                        {card.wantSkill}
                      </p>
                    </div>
                  </div>
                  {matches.length > 0 && (
                    <p
                      data-testid={`ss-match-${card.cardId}`}
                      className="text-xs text-purple-600 font-semibold mt-2"
                    >
                      🤝 配對：{matches.join("、")}
                    </p>
                  )}
                  <div className="flex justify-end mt-2">
                    <button
                      data-testid={`ss-heart-${card.cardId}`}
                      onClick={() => onHeart(card.cardId)}
                      className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full ${
                        hearted ? "text-rose-600 bg-rose-50" : "text-gray-400 hover:text-rose-400"
                      }`}
                    >
                      {hearted ? "❤️" : "🤍"}
                      <span data-testid={`ss-heart-count-${card.cardId}`}>
                        {card.hearts.length}
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
