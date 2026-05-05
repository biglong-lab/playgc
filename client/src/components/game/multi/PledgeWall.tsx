export interface PledgeCard {
  userId: string;
  userName: string;
  pledge: string;
  emoji: string;
  supportCount: number;
  supporters: string[];
  addedAt: number;
}

export interface PledgeWallConfig {
  title: string;
  prompt?: string;
  placeholder?: string;
  maxLength: number;
  showSupport: boolean;
  emojiOptions: string[];
}

export interface PledgeWallState extends Record<string, unknown> {
  pledges: PledgeCard[];
}

interface PledgeWallProps {
  config: PledgeWallConfig;
  state: PledgeWallState;
  myUserId: string;
  draftText: string;
  draftEmoji: string;
  onTextChange: (v: string) => void;
  onEmojiChange: (v: string) => void;
  onSubmit: () => void;
  onSupport: (targetUserId: string) => void;
}

export default function PledgeWall({
  config,
  state,
  myUserId,
  draftText,
  draftEmoji,
  onTextChange,
  onEmojiChange,
  onSubmit,
  onSupport,
}: PledgeWallProps) {
  const myPledge = state.pledges.find((p) => p.userId === myUserId);
  const hasSubmitted = !!myPledge;
  const canSubmit = draftText.trim().length > 0 && draftEmoji !== "";

  const sorted = [...state.pledges].sort((a, b) => b.supportCount - a.supportCount || a.addedAt - b.addedAt);

  return (
    <div data-testid="pledge-wall-root" className="p-4 space-y-4 max-w-lg mx-auto">
      <div>
        <h2 data-testid="pledge-title" className="text-xl font-bold text-slate-800">
          {config.title}
        </h2>
        {config.prompt && (
          <p data-testid="pledge-prompt" className="text-sm text-slate-500 mt-1">
            {config.prompt}
          </p>
        )}
      </div>

      <div data-testid="pledge-count" className="text-xs text-slate-400">
        共 <span className="font-semibold text-indigo-600">{state.pledges.length}</span> 個承諾
      </div>

      {/* 填寫表單 */}
      {!hasSubmitted && (
        <div data-testid="pledge-form" className="p-3 bg-indigo-50 rounded-xl space-y-2 border border-indigo-100">
          <div className="flex gap-2 flex-wrap">
            {config.emojiOptions.map((em) => (
              <button
                key={em}
                data-testid={`pledge-emoji-${em}`}
                onClick={() => onEmojiChange(em === draftEmoji ? "" : em)}
                className={`text-xl rounded-lg px-1.5 py-1 transition ${
                  draftEmoji === em ? "bg-indigo-200 ring-2 ring-indigo-400" : "hover:bg-slate-200"
                }`}
              >
                {em}
              </button>
            ))}
          </div>
          <textarea
            data-testid="pledge-text-input"
            value={draftText}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={config.placeholder ?? "我承諾…"}
            rows={2}
            maxLength={config.maxLength}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {draftText.length} / {config.maxLength}
            </span>
            <button
              data-testid="submit-pledge-btn"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 transition disabled:opacity-40"
            >
              公開承諾
            </button>
          </div>
        </div>
      )}

      {hasSubmitted && (
        <div data-testid="my-pledge-card" className="p-3 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{myPledge.emoji}</span>
            <div>
              <p className="text-sm font-medium text-green-800">{myPledge.pledge}</p>
              <p className="text-xs text-green-600">✅ 已公開承諾</p>
            </div>
          </div>
        </div>
      )}

      {/* 承諾牆 */}
      {sorted.length > 0 && (
        <div data-testid="pledge-list" className="space-y-2">
          {sorted.map((pledge) => {
            const isMe = pledge.userId === myUserId;
            const hasSupported = pledge.supporters.includes(myUserId);

            return (
              <div
                key={pledge.userId}
                data-testid={`pledge-${pledge.userId}`}
                className={`p-3 rounded-xl border ${isMe ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200"}`}
              >
                <div className="flex items-start gap-3">
                  <span data-testid={`pledge-emoji-display-${pledge.userId}`} className="text-2xl flex-shrink-0 mt-0.5">
                    {pledge.emoji}
                  </span>
                  <div className="flex-1">
                    <p data-testid={`pledge-text-display-${pledge.userId}`} className="text-sm text-slate-700">
                      {pledge.pledge}
                    </p>
                    <p data-testid={`pledge-author-${pledge.userId}`} className="text-xs text-slate-400 mt-0.5">
                      — {pledge.userName}
                    </p>
                  </div>
                  {config.showSupport && !isMe && (
                    <button
                      data-testid={`support-btn-${pledge.userId}`}
                      onClick={() => onSupport(pledge.userId)}
                      className={`flex-shrink-0 flex flex-col items-center px-2 py-1 rounded-lg text-xs transition ${
                        hasSupported ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      <span>🙌</span>
                      <span data-testid={`support-count-${pledge.userId}`}>{pledge.supportCount}</span>
                    </button>
                  )}
                  {(isMe || !config.showSupport) && (
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {pledge.supportCount > 0 ? `🙌 ${pledge.supportCount}` : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sorted.length === 0 && (
        <div data-testid="empty-pledges" className="text-center text-slate-400 py-8 text-sm">
          還沒有人許下承諾，快來第一個！
        </div>
      )}
    </div>
  );
}
