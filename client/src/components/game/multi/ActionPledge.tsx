import React from "react";

export interface ActionPledgeConfig {
  title: string;
  prompt: string;
  actionLabel: string;
  timelineOptions: string[];
  showAuthor: boolean;
}

export interface PledgeEntry {
  pledgeId: string;
  userId: string;
  userName: string;
  action: string;
  timeline: string;
}

export interface ActionPledgeState extends Record<string, unknown> {
  pledges: PledgeEntry[];
  revealed: boolean;
}

interface Props {
  config: ActionPledgeConfig;
  state: ActionPledgeState;
  myUserId: string;
  draftAction: string;
  draftTimeline: string;
  onDraftActionChange: (text: string) => void;
  onDraftTimelineChange: (timeline: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

const TIMELINE_COLORS: Record<string, string> = {
  "1週內": "bg-green-100 text-green-700",
  "2週內": "bg-lime-100 text-lime-700",
  "1個月內": "bg-yellow-100 text-yellow-700",
  "3個月內": "bg-orange-100 text-orange-700",
};

function timelineColor(t: string) {
  return TIMELINE_COLORS[t] ?? "bg-blue-100 text-blue-700";
}

export default function ActionPledge({
  config,
  state,
  myUserId,
  draftAction,
  draftTimeline,
  onDraftActionChange,
  onDraftTimelineChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, prompt, actionLabel, timelineOptions, showAuthor } = config;
  const { pledges, revealed } = state;

  const myPledge = pledges.find((p) => p.userId === myUserId);
  const hasSubmitted = !!myPledge;
  const canSubmit = draftAction.trim().length > 0 && draftTimeline.length > 0;

  return (
    <div data-testid="ap-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="ap-title" className="text-lg font-bold text-center">
        {title}
      </h2>

      {/* 提示語 */}
      <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-center">
        <p className="text-sm text-indigo-700 font-medium">{prompt}</p>
      </div>

      {/* 輸入區（未送出且未揭曉） */}
      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border-2 border-gray-200 focus-within:border-indigo-400 overflow-hidden">
            <div className="bg-indigo-50 px-3 py-2 text-sm text-indigo-600 font-medium border-b border-gray-100">
              {actionLabel}
            </div>
            <textarea
              data-testid="ap-action-input"
              value={draftAction}
              onChange={(e) => onDraftActionChange(e.target.value)}
              rows={2}
              placeholder="具體寫下你打算做什麼…"
              className="w-full px-3 py-2 text-sm resize-none focus:outline-none"
            />
          </div>

          {/* 期限選擇 */}
          <div className="flex gap-2 flex-wrap">
            {timelineOptions.map((opt) => (
              <button
                key={opt}
                data-testid={`ap-timeline-${opt}`}
                onClick={() => onDraftTimelineChange(opt)}
                className={[
                  "px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors",
                  draftTimeline === opt
                    ? "bg-indigo-500 border-indigo-500 text-white"
                    : "bg-white border-gray-300 text-gray-600 hover:border-indigo-300",
                ].join(" ")}
              >
                {opt}
              </button>
            ))}
          </div>

          <button
            data-testid="ap-submit-btn"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors self-end"
          >
            提交承諾
          </button>
        </div>
      )}

      {/* 已送出提示 */}
      {hasSubmitted && !revealed && (
        <div data-testid="ap-submitted-msg" className="rounded-xl bg-green-50 border border-green-200 p-3">
          <p className="text-sm font-semibold text-green-700">✅ 承諾已送出！</p>
          <p className="text-sm text-green-600 mt-1">{myPledge.action}</p>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${timelineColor(myPledge.timeline)}`}>
            {myPledge.timeline}
          </span>
        </div>
      )}

      {/* 揭曉控制 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="ap-count">{pledges.length}</span> 人已填寫
          </p>
          <button
            data-testid="ap-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            揭曉所有承諾
          </button>
        </div>
      )}

      {/* 揭曉後：承諾牆 */}
      {revealed && (
        <div data-testid="ap-pledges" className="flex flex-col gap-3">
          <p className="text-center text-indigo-600 text-sm font-semibold">
            🎯 共 {pledges.length} 則行動承諾
          </p>
          {pledges.length === 0 ? (
            <p data-testid="ap-empty" className="text-center text-gray-400 text-sm py-4">
              還沒有人填寫
            </p>
          ) : (
            pledges.map((p) => (
              <div
                key={p.pledgeId}
                data-testid={`ap-pledge-${p.pledgeId}`}
                className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
              >
                {showAuthor && (
                  <p
                    data-testid={`ap-author-${p.pledgeId}`}
                    className="text-xs text-gray-400 mb-1 font-semibold"
                  >
                    {p.userName}
                  </p>
                )}
                <p
                  data-testid={`ap-action-${p.pledgeId}`}
                  className="text-sm text-gray-700"
                >
                  <span className="text-indigo-500 font-medium">{actionLabel}</span>{" "}
                  {p.action}
                </p>
                <span
                  data-testid={`ap-timeline-badge-${p.pledgeId}`}
                  className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${timelineColor(p.timeline)}`}
                >
                  {p.timeline}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
