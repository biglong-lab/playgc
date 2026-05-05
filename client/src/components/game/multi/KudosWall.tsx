import { useState } from "react";

export interface KudosCard extends Record<string, unknown> {
  kudosId: string;
  fromUserId: string;
  fromUserName: string;
  toName: string;
  message: string;
}

export interface KudosWallConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
}

export interface KudosWallState extends Record<string, unknown> {
  kudos: KudosCard[];
  revealed: boolean;
}

const DEFAULT_CONFIG: KudosWallConfig = {
  title: "感謝牆",
  prompt: "向誰說一句謝謝？",
  maxLength: 80,
};

interface Props {
  config: KudosWallConfig;
  state: KudosWallState;
  myUserId: string;
  onSubmit: (toName: string, message: string) => void;
  onReveal: () => void;
}

export default function KudosWall({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
}: Props) {
  const [toName, setToName] = useState("");
  const [message, setMessage] = useState("");

  const { title, prompt, maxLength } = config || DEFAULT_CONFIG;
  const { kudos, revealed } = state;

  const myCards = kudos.filter((k) => k.fromUserId === myUserId);

  function handleSubmit() {
    const nameTrimmed = toName.trim();
    const msgTrimmed = message.trim();
    if (!nameTrimmed || !msgTrimmed) return;
    onSubmit(nameTrimmed, msgTrimmed);
    setToName("");
    setMessage("");
  }

  const CARD_COLORS = [
    "from-rose-50 to-pink-50 border-rose-200",
    "from-amber-50 to-yellow-50 border-amber-200",
    "from-emerald-50 to-green-50 border-emerald-200",
    "from-sky-50 to-blue-50 border-sky-200",
    "from-violet-50 to-purple-50 border-violet-200",
  ];

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="kw-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <p data-testid="kw-prompt" className="text-sm text-gray-600 text-center">
        {prompt}
      </p>

      {!revealed && (
        <div className="space-y-3">
          <div className="space-y-2 p-4 bg-pink-50 rounded-xl border border-pink-100">
            <input
              data-testid="kw-to-input"
              type="text"
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              placeholder="對象姓名..."
              maxLength={30}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <div className="relative">
              <textarea
                data-testid="kw-msg-input"
                value={message}
                onChange={(e) => {
                  if (e.target.value.length <= maxLength) setMessage(e.target.value);
                }}
                placeholder="感謝的話..."
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none pr-12"
              />
              <span className="absolute right-3 bottom-2 text-xs text-gray-400">
                {message.length}/{maxLength}
              </span>
            </div>
            <button
              data-testid="kw-submit-btn"
              onClick={handleSubmit}
              disabled={toName.trim().length === 0 || message.trim().length === 0}
              className="w-full py-2 bg-pink-500 text-white rounded-lg text-sm font-bold hover:bg-pink-600 disabled:opacity-40"
            >
              💌 送出感謝
            </button>
          </div>

          {myCards.length > 0 && (
            <p data-testid="kw-my-count" className="text-xs text-center text-gray-400">
              你已送出 {myCards.length} 張感謝卡
            </p>
          )}

          <p className="text-xs text-center text-gray-400">
            共 <span data-testid="kw-count">{kudos.length}</span> 張感謝卡
          </p>

          <div className="text-center">
            <button
              data-testid="kw-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布感謝牆
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div data-testid="kw-result" className="space-y-2">
          {kudos.length === 0 ? (
            <div data-testid="kw-empty" className="text-center text-gray-400 py-8">
              尚無感謝卡
            </div>
          ) : (
            kudos.map((k, idx) => (
              <div
                key={k.kudosId}
                data-testid={`kw-card-${k.kudosId}`}
                className={`p-3 bg-gradient-to-r ${CARD_COLORS[idx % CARD_COLORS.length]} border rounded-xl`}
              >
                <p className="text-xs text-gray-500 mb-1">
                  {k.fromUserName} → <span className="font-semibold text-gray-700">{k.toName}</span>
                </p>
                <p className="text-sm text-gray-700">{k.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
