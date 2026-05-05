import { useState } from "react";

export interface FactEntry extends Record<string, unknown> {
  factId: string;
  userId: string;
  userName: string;
  text: string;
  hearts: string[];
}

export interface PersonalFactConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
  showAuthor: boolean;
}

export interface PersonalFactState extends Record<string, unknown> {
  facts: FactEntry[];
  revealed: boolean;
}

const DEFAULT_CONFIG: PersonalFactConfig = {
  title: "趣味自我揭秘",
  prompt: "說一個關於你自己、讓大家驚訝的小事",
  maxLength: 100,
  showAuthor: true,
};

interface Props {
  config: PersonalFactConfig;
  state: PersonalFactState;
  myUserId: string;
  onSubmit: (text: string) => void;
  onReveal: () => void;
  onHeart: (factId: string) => void;
}

export default function PersonalFact({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
  onHeart,
}: Props) {
  const [text, setText] = useState("");

  const maxLength = config.maxLength ?? DEFAULT_CONFIG.maxLength;
  const showAuthor = config.showAuthor ?? DEFAULT_CONFIG.showAuthor;
  const { facts, revealed } = state;

  const myFact = facts.find((f) => f.userId === myUserId);
  const overLimit = text.length > maxLength;
  const canSubmit = text.trim().length > 0 && !overLimit && !myFact;

  const sorted = revealed
    ? [...facts].sort((a, b) => b.hearts.length - a.hearts.length)
    : facts;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(text.trim());
    setText("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2
        data-testid="pf-title"
        className="text-xl font-bold text-center"
      >
        {config.title || DEFAULT_CONFIG.title}
      </h2>
      <p
        data-testid="pf-prompt"
        className="text-center text-gray-600 text-sm"
      >
        {config.prompt || DEFAULT_CONFIG.prompt}
      </p>

      {!myFact && (
        <div className="space-y-2">
          <textarea
            data-testid="pf-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例如：我曾在飛機上遇到知名歌手…"
            rows={3}
            className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                data-testid="pf-char-count"
                className={`text-xs ${
                  overLimit ? "text-red-500" : "text-gray-400"
                }`}
              >
                {text.length}/{maxLength}
              </span>
              {overLimit && (
                <span
                  data-testid="pf-char-error"
                  className="text-xs text-red-500"
                >
                  超過字數限制
                </span>
              )}
            </div>
            <button
              data-testid="pf-submit-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-violet-700 disabled:cursor-not-allowed"
            >
              送出
            </button>
          </div>
        </div>
      )}

      {myFact && (
        <p
          data-testid="pf-submitted-msg"
          className="text-center text-sm text-green-600"
        >
          ✅ 已送出你的趣味事實
        </p>
      )}

      <div className="flex items-center justify-between">
        <p
          data-testid="pf-count"
          className="text-xs text-gray-400"
        >
          已送出：{facts.length} 則
        </p>
        {!revealed && (
          <button
            data-testid="pf-reveal-btn"
            onClick={onReveal}
            className="px-3 py-1 text-sm bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200"
          >
            揭曉全部
          </button>
        )}
      </div>

      {revealed && facts.length === 0 && (
        <div
          data-testid="pf-empty"
          className="text-center text-gray-400 py-8"
        >
          尚無趣味事實
        </div>
      )}

      {revealed && facts.length > 0 && (
        <div className="space-y-3">
          {sorted.map((fact) => {
            const hasHearted = fact.hearts.includes(myUserId);
            const isOwn = fact.userId === myUserId;
            return (
              <div
                key={fact.factId}
                data-testid={`pf-fact-${fact.factId}`}
                className={`p-3 rounded-lg border ${
                  isOwn
                    ? "border-violet-200 bg-violet-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <p className="text-sm leading-relaxed">{fact.text}</p>
                {showAuthor && (
                  <p
                    data-testid={`pf-author-${fact.factId}`}
                    className="text-xs text-gray-400 mt-1"
                  >
                    — {fact.userName}
                    {isOwn && (
                      <span className="ml-1 text-violet-500">（我）</span>
                    )}
                  </p>
                )}
                <div className="mt-2">
                  <button
                    data-testid={`pf-heart-${fact.factId}`}
                    onClick={() => onHeart(fact.factId)}
                    disabled={isOwn}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      hasHearted
                        ? "bg-red-100 text-red-600"
                        : "bg-gray-100 text-gray-500 hover:bg-red-50"
                    } disabled:opacity-40`}
                  >
                    ❤️{" "}
                    <span
                      data-testid={`pf-heart-count-${fact.factId}`}
                    >
                      {fact.hearts.length}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
