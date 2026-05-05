import { useState } from "react";

export interface MarketIdea extends Record<string, unknown> {
  ideaId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface TokenAlloc extends Record<string, unknown> {
  investorId: string;
  ideaId: string;
  tokens: number;
}

export interface IdeaMarketConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  tokenBudget: number;
  maxIdeaLength: number;
  showAuthor: boolean;
}

export interface IdeaMarketState extends Record<string, unknown> {
  ideas: MarketIdea[];
  allocations: TokenAlloc[];
  phase: "pitch" | "invest" | "result";
}

const DEFAULT_CONFIG: IdeaMarketConfig = {
  title: "創意市集",
  prompt: "用一句話說出你的創意點子",
  tokenBudget: 5,
  maxIdeaLength: 80,
  showAuthor: true,
};

const PHASE_LABELS: Record<IdeaMarketState["phase"], string> = {
  pitch: "提案",
  invest: "投資",
  result: "結果",
};

const ADVANCE_LABELS: Partial<Record<IdeaMarketState["phase"], string>> = {
  pitch: "開始投資",
  invest: "揭曉結果",
};

interface Props {
  config: IdeaMarketConfig;
  state: IdeaMarketState;
  myUserId: string;
  onSubmitIdea: (text: string) => void;
  onInvest: (ideaId: string, delta: number) => void;
  onAdvancePhase: () => void;
}

export default function IdeaMarket({
  config,
  state,
  myUserId,
  onSubmitIdea,
  onInvest,
  onAdvancePhase,
}: Props) {
  const [text, setText] = useState("");

  const tokenBudget = config.tokenBudget ?? DEFAULT_CONFIG.tokenBudget;
  const maxIdeaLength =
    config.maxIdeaLength ?? DEFAULT_CONFIG.maxIdeaLength;
  const showAuthor = config.showAuthor ?? DEFAULT_CONFIG.showAuthor;
  const { ideas, allocations, phase } = state;

  const myIdea = ideas.find((i) => i.userId === myUserId);
  const overLimit = text.length > maxIdeaLength;
  const canSubmit =
    text.trim().length > 0 && !overLimit && !myIdea;

  // Investment helpers
  function myTokensFor(ideaId: string): number {
    return (
      allocations.find(
        (a) => a.investorId === myUserId && a.ideaId === ideaId
      )?.tokens ?? 0
    );
  }

  function myTotalInvested(): number {
    return allocations
      .filter((a) => a.investorId === myUserId)
      .reduce((s, a) => s + a.tokens, 0);
  }

  function totalTokensFor(ideaId: string): number {
    return allocations
      .filter((a) => a.ideaId === ideaId)
      .reduce((s, a) => s + a.tokens, 0);
  }

  const budgetRemaining = tokenBudget - myTotalInvested();

  // Result helpers
  function getSortedIdeas(): Array<MarketIdea & { total: number }> {
    return [...ideas]
      .map((i) => ({ ...i, total: totalTokensFor(i.ideaId) }))
      .sort((a, b) => b.total - a.total);
  }

  function maxTotal(): number {
    const totals = ideas.map((i) => totalTokensFor(i.ideaId));
    return Math.max(1, ...totals);
  }

  const othersIdeas = ideas.filter((i) => i.userId !== myUserId);

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmitIdea(text.trim());
    setText("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2
        data-testid="im-title"
        className="text-xl font-bold text-center"
      >
        {config.title || DEFAULT_CONFIG.title}
      </h2>
      <div
        data-testid="im-phase"
        className="text-sm text-center text-gray-500"
      >
        {PHASE_LABELS[phase]}
      </div>
      <p
        data-testid="im-prompt"
        className="text-center text-gray-600"
      >
        {config.prompt || DEFAULT_CONFIG.prompt}
      </p>

      {/* Pitch phase */}
      {phase === "pitch" && (
        <div className="space-y-3">
          {!myIdea && (
            <div className="space-y-2">
              <textarea
                data-testid="im-pitch-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="輸入你的創意點子…"
                rows={3}
                className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <div className="flex items-center justify-between">
                <span
                  data-testid="im-pitch-char-count"
                  className={`text-xs ${
                    overLimit ? "text-red-500" : "text-gray-400"
                  }`}
                >
                  {text.length}/{maxIdeaLength}
                </span>
                <button
                  data-testid="im-pitch-submit"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-emerald-700"
                >
                  送出點子
                </button>
              </div>
            </div>
          )}
          {myIdea && (
            <div
              data-testid="im-submitted-msg"
              className="text-center p-3 bg-emerald-50 rounded-lg"
            >
              <p className="text-emerald-700 font-medium">
                ✅ 已送出你的點子
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p
              data-testid="im-pitch-count"
              className="text-xs text-gray-400"
            >
              已提案：{ideas.length} 個
            </p>
            <button
              data-testid="im-advance-btn"
              onClick={onAdvancePhase}
              className="px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              {ADVANCE_LABELS[phase]}
            </button>
          </div>
        </div>
      )}

      {/* Invest phase */}
      {phase === "invest" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-yellow-50 rounded-lg p-3">
            <span className="text-sm font-medium text-yellow-800">
              💰 剩餘代幣
            </span>
            <span
              data-testid="im-budget-remaining"
              className="text-2xl font-bold text-yellow-700"
            >
              {budgetRemaining}
            </span>
          </div>
          {othersIdeas.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">
              目前還沒有其他人的點子
            </p>
          ) : (
            othersIdeas.map((idea) => {
              const myTokens = myTokensFor(idea.ideaId);
              const canAdd = budgetRemaining > 0;
              const canRemove = myTokens > 0;
              return (
                <div
                  key={idea.ideaId}
                  data-testid={`im-idea-${idea.ideaId}`}
                  className="p-3 border rounded-lg bg-white space-y-2"
                >
                  <p className="text-sm">{idea.text}</p>
                  {showAuthor && (
                    <p className="text-xs text-gray-400">
                      — {idea.userName}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      data-testid={`im-disinvest-${idea.ideaId}`}
                      onClick={() => onInvest(idea.ideaId, -1)}
                      disabled={!canRemove}
                      className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 hover:bg-red-100 disabled:opacity-30 text-lg"
                    >
                      -
                    </button>
                    <span
                      data-testid={`im-tokens-${idea.ideaId}`}
                      className="w-8 text-center font-bold text-emerald-700"
                    >
                      {myTokens}
                    </span>
                    <button
                      data-testid={`im-invest-${idea.ideaId}`}
                      onClick={() => onInvest(idea.ideaId, 1)}
                      disabled={!canAdd}
                      className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-30 text-lg"
                    >
                      +
                    </button>
                    <span className="text-xs text-gray-400">代幣</span>
                  </div>
                </div>
              );
            })
          )}
          <button
            data-testid="im-advance-btn"
            onClick={onAdvancePhase}
            className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          >
            {ADVANCE_LABELS[phase]}
          </button>
        </div>
      )}

      {/* Result phase */}
      {phase === "result" && (
        <div className="space-y-3">
          {ideas.length === 0 ? (
            <div
              data-testid="im-empty"
              className="text-center text-gray-400 py-8"
            >
              尚無提案
            </div>
          ) : (
            <>
              {getSortedIdeas().map((idea, idx) => {
                const pct =
                  Math.round((idea.total / maxTotal()) * 100);
                return (
                  <div
                    key={idea.ideaId}
                    data-testid={`im-result-${idea.ideaId}`}
                    className={`p-3 rounded-lg border ${
                      idx === 0
                        ? "border-yellow-300 bg-yellow-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    {idx === 0 && (
                      <div
                        data-testid="im-winner"
                        className="text-xs font-bold text-yellow-700 mb-1"
                      >
                        🏆 最高投資
                      </div>
                    )}
                    <p className="text-sm">{idea.text}</p>
                    {showAuthor && (
                      <p className="text-xs text-gray-400">
                        — {idea.userName}
                      </p>
                    )}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span
                          data-testid={`im-total-tokens-${idea.ideaId}`}
                          className="text-emerald-700 font-medium"
                        >
                          💰 {idea.total} 代幣
                        </span>
                        <span className="text-gray-400">{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
