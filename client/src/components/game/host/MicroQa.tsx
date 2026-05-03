// 📺 MicroQa — HostScreen 即時 Q&A 元件（W22 D3，講座 / 會議核心元件）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md + docs/manual/01-host-components.md
// pageType: host_micro_qa
//
// 玩法：
//   - 觀眾匿名 / 具名送問題
//   - 觀眾可點讚別人的問題（推熱門問題上頂）
//   - 大螢幕按讚數排序顯示、主持人標記「已回答」後沉到底
//   - 適用：講座、企業大會、學術研討、產品發表會、市政說明會
//
// state 結構：
//   {
//     questions: Question[];        // 全部問題（最多 50）
//     totalAsks: number;
//     totalUpvotes: number;
//   }
//
// pulse 結構：
//   - { type: "ask", payload: { text, askedBy? } }
//   - { type: "upvote", payload: { questionId } }
//   - { type: "mark_answered", payload: { questionId } }（hostMode 用）

import { useCallback, useMemo, useRef, useState } from "react";

const MAX_TEXT = 140;
const PLAYER_THROTTLE_MS = 5000;
const UPVOTE_THROTTLE_MS = 500;

export interface QaQuestion {
  id: string;
  text: string;
  askedBy: string; // "匿名" 或具名
  upvotes: number;
  askedAt: number;
  answered: boolean;
}

export interface MicroQaConfig {
  /** 標題 */
  title?: string;
  /** 副標 / 主題 */
  subtitle?: string;
  /** 字數上限（預設 140）*/
  maxLength?: number;
  /** 是否允許匿名（預設 true）*/
  allowAnonymous?: boolean;
}

export interface MicroQaState {
  questions: QaQuestion[];
  totalAsks: number;
  totalUpvotes: number;
}

export interface MicroQaProps {
  config: MicroQaConfig;
  hostMode: boolean;
  state?: MicroQaState | null;
  onPulse?: (
    pulseType: string,
    payload: { text?: string; askedBy?: string; questionId?: string },
  ) => void;
  onBroadcastState?: (state: MicroQaState) => void;
}

function buildInitialState(): MicroQaState {
  return { questions: [], totalAsks: 0, totalUpvotes: 0 };
}

export default function MicroQa({ config, hostMode, state, onPulse }: MicroQaProps) {
  const maxLength = config.maxLength ?? MAX_TEXT;
  const allowAnonymous = config.allowAnonymous !== false;
  const effectiveState = state ?? buildInitialState();
  const lastSubmitRef = useRef(0);
  const lastUpvoteRef = useRef<Record<string, number>>({});

  const [text, setText] = useState("");
  const [askedBy, setAskedBy] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const sortedQuestions = useMemo(() => {
    return [...effectiveState.questions].sort((a, b) => {
      if (a.answered !== b.answered) return a.answered ? 1 : -1;
      if (a.upvotes !== b.upvotes) return b.upvotes - a.upvotes;
      return b.askedAt - a.askedAt;
    });
  }, [effectiveState.questions]);

  const handleSubmit = useCallback(() => {
    const submitTime = Date.now();
    if (submitTime - lastSubmitRef.current < PLAYER_THROTTLE_MS) return;
    if (!text.trim()) return;
    lastSubmitRef.current = submitTime;
    onPulse?.("ask", {
      text: text.trim().slice(0, maxLength),
      askedBy: anonymous || !askedBy.trim() ? "匿名" : askedBy.trim().slice(0, 20),
    });
    setSubmitted(true);
    setText("");
    setTimeout(() => setSubmitted(false), 2000);
  }, [text, askedBy, anonymous, maxLength, onPulse]);

  const handleUpvote = useCallback(
    (questionId: string) => {
      const upvoteTime = Date.now();
      const last = lastUpvoteRef.current[questionId] ?? 0;
      if (upvoteTime - last < UPVOTE_THROTTLE_MS) return;
      lastUpvoteRef.current[questionId] = upvoteTime;
      onPulse?.("upvote", { questionId });
    },
    [onPulse],
  );

  const handleMarkAnswered = useCallback(
    (questionId: string) => {
      onPulse?.("mark_answered", { questionId });
    },
    [onPulse],
  );

  // ─── 大螢幕版型 ───
  if (hostMode) {
    const unanswered = sortedQuestions.filter((q) => !q.answered);
    const answered = sortedQuestions.filter((q) => q.answered);
    return (
      <div className="w-full h-full min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-5xl font-bold text-blue-900 dark:text-blue-100">
              {config.title ?? "💬 即時 Q&A"}
            </h1>
            {config.subtitle && (
              <p className="text-base md:text-xl mt-2 text-blue-700 dark:text-blue-300">{config.subtitle}</p>
            )}
            <p className="text-sm mt-3 text-blue-700 dark:text-blue-300 opacity-70">
              共 {effectiveState.totalAsks} 題 · {effectiveState.totalUpvotes} 個讚 · 待回答 {unanswered.length} 題
            </p>
          </div>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto" data-testid="qa-list">
            {unanswered.length === 0 && answered.length === 0 ? (
              <div className="text-center py-12 text-blue-700 dark:text-blue-300 opacity-60">
                還沒有問題、等待觀眾發問...
              </div>
            ) : (
              <>
                {unanswered.map((q, idx) => (
                  <div
                    key={q.id}
                    data-testid={`qa-item-${q.id}`}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${
                      idx === 0
                        ? "bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 border-amber-400 shadow-lg"
                        : "bg-white dark:bg-zinc-800 border-blue-200 dark:border-blue-800/50"
                    }`}
                  >
                    <div className="flex flex-col items-center min-w-[3rem]">
                      <button
                        onClick={() => handleMarkAnswered(q.id)}
                        data-testid={`qa-mark-answered-${q.id}`}
                        className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200"
                        title="標記已回答"
                      >
                        ✓
                      </button>
                      <div className="text-xs mt-1 text-blue-700 dark:text-blue-300 opacity-70">{idx === 0 && "🔥"}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm md:text-base font-medium text-zinc-900 dark:text-zinc-100">{q.text}</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">— {q.askedBy}</p>
                    </div>
                    <div className="flex flex-col items-center min-w-[3rem]">
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">▲ {q.upvotes}</div>
                      <div className="text-xs opacity-60">讚數</div>
                    </div>
                  </div>
                ))}
                {answered.length > 0 && (
                  <div className="pt-4 border-t-2 border-zinc-300 dark:border-zinc-700">
                    <p className="text-xs text-zinc-500 mb-2">已回答 {answered.length} 題</p>
                    {answered.map((q) => (
                      <div
                        key={q.id}
                        data-testid={`qa-item-${q.id}`}
                        className="p-2 rounded mb-1 bg-zinc-100 dark:bg-zinc-900/40 opacity-70 text-xs"
                      >
                        ✓ {q.text} <span className="text-zinc-500">— {q.askedBy}（▲ {q.upvotes}）</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── 玩家版型（手機）───
  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 p-4">
      <div className="max-w-md mx-auto pt-4">
        <h1 className="text-xl font-bold text-blue-900 dark:text-blue-100 text-center">
          {config.title ?? "💬 即時 Q&A"}
        </h1>
        {config.subtitle && (
          <p className="text-sm text-blue-700 dark:text-blue-300 text-center mt-1">{config.subtitle}</p>
        )}

        <div className="mt-4 rounded-xl border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-zinc-900 p-4">
          <textarea
            data-testid="qa-input"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, maxLength))}
            placeholder="想問什麼問題？"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none"
          />
          <div className="text-right text-xs text-zinc-500 mt-1">
            {text.length}/{maxLength}
          </div>

          {allowAnonymous && (
            <label className="flex items-center gap-2 mt-2 text-sm text-blue-900 dark:text-blue-100">
              <input
                type="checkbox"
                data-testid="qa-anonymous"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
              />
              匿名發問
            </label>
          )}
          {!anonymous && (
            <input
              type="text"
              data-testid="qa-name"
              value={askedBy}
              onChange={(e) => setAskedBy(e.target.value)}
              maxLength={20}
              placeholder="你的名字"
              className="w-full mt-2 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          )}

          <button
            data-testid="qa-submit"
            onClick={handleSubmit}
            disabled={!text.trim() || submitted}
            className="w-full mt-3 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {submitted ? "✓ 已送出！" : "送出問題"}
          </button>
        </div>

        {sortedQuestions.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              👀 看看其他問題（點 ▲ 推熱門）
            </h2>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {sortedQuestions.slice(0, 20).map((q) => (
                <div
                  key={q.id}
                  data-testid={`qa-player-item-${q.id}`}
                  className={`p-3 rounded-lg border ${
                    q.answered
                      ? "bg-zinc-100 dark:bg-zinc-900/40 border-zinc-300 opacity-60"
                      : "bg-white dark:bg-zinc-800 border-blue-200 dark:border-blue-800/50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => handleUpvote(q.id)}
                      disabled={q.answered}
                      data-testid={`qa-upvote-${q.id}`}
                      className="flex flex-col items-center px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50"
                    >
                      <span className="text-lg">▲</span>
                      <span className="text-xs font-bold">{q.upvotes}</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{q.text}</p>
                      <p className="text-xs text-zinc-500 mt-1">— {q.askedBy} {q.answered && "（已回答）"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
