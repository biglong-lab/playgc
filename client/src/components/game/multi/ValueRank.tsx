import React from "react";

export interface ValueRankConfig {
  title: string;
  prompt: string;
  items: string[];
  showAuthor: boolean;
}

export interface RankEntry {
  entryId: string;
  userId: string;
  userName: string;
  order: string[]; // items sorted from most → least important
}

export interface ValueRankState extends Record<string, unknown> {
  rankings: RankEntry[];
  revealed: boolean;
}

interface Props {
  config: ValueRankConfig;
  state: ValueRankState;
  myUserId: string;
  draftOrder: string[];
  onOrderChange: (newOrder: string[]) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

function moveItem(arr: string[], from: number, to: number): string[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function computeBorda(rankings: RankEntry[], items: string[]): { item: string; score: number }[] {
  const n = items.length;
  const scores: Record<string, number> = {};
  items.forEach((it) => (scores[it] = 0));
  rankings.forEach((r) => {
    r.order.forEach((item, idx) => {
      if (scores[item] !== undefined) scores[item] += n - 1 - idx;
    });
  });
  return items
    .map((item) => ({ item, score: scores[item] }))
    .sort((a, b) => b.score - a.score);
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const RANK_COLORS = [
  "bg-yellow-50 border-yellow-300",
  "bg-gray-50 border-gray-300",
  "bg-orange-50 border-orange-300",
];

export default function ValueRank({
  config,
  state,
  myUserId,
  draftOrder,
  onOrderChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, prompt, items, showAuthor } = config;
  const { rankings, revealed } = state;

  const myEntry = rankings.find((r) => r.userId === myUserId);
  const hasSubmitted = !!myEntry;
  const maxScore = (items.length - 1) * rankings.length;

  const bordaResult = revealed ? computeBorda(rankings, items) : [];

  return (
    <div data-testid="vr-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="vr-title" className="text-lg font-bold text-center">{title}</h2>
      <p data-testid="vr-prompt" className="text-sm text-gray-500 text-center">{prompt}</p>

      {/* 輸入：排序清單 */}
      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 text-center">拖曳或點箭頭調整順序（第一名最重要）</p>
          {draftOrder.map((item, idx) => (
            <div
              key={item}
              data-testid={`vr-item-${idx}`}
              className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2"
            >
              <span className="text-xs font-bold text-indigo-400 w-5 text-center">{idx + 1}</span>
              <span className="flex-1 text-sm text-gray-700">{item}</span>
              <button
                data-testid={`vr-up-${idx}`}
                onClick={() => onOrderChange(moveItem(draftOrder, idx, idx - 1))}
                disabled={idx === 0}
                className="text-indigo-400 hover:text-indigo-600 disabled:opacity-30 px-1"
              >
                ▲
              </button>
              <button
                data-testid={`vr-down-${idx}`}
                onClick={() => onOrderChange(moveItem(draftOrder, idx, idx + 1))}
                disabled={idx === draftOrder.length - 1}
                className="text-indigo-400 hover:text-indigo-600 disabled:opacity-30 px-1"
              >
                ▼
              </button>
            </div>
          ))}

          <button
            data-testid="vr-submit-btn"
            onClick={onSubmit}
            className="mt-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors self-end"
          >
            送出排序
          </button>
        </div>
      )}

      {/* 已送出 */}
      {hasSubmitted && !revealed && (
        <div data-testid="vr-submitted-msg" className="rounded-xl bg-green-50 border border-green-200 p-3">
          <p className="text-sm font-semibold text-green-700">✅ 排序已送出！</p>
          <p className="text-xs text-green-500 mt-1">你的排序：{myEntry.order.join(" › ")}</p>
        </div>
      )}

      {/* 揭曉控制 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="vr-count">{rankings.length}</span> 人已排序
          </p>
          <button
            data-testid="vr-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            揭曉集體排名
          </button>
        </div>
      )}

      {/* 揭曉後：Borda 計分結果 */}
      {revealed && (
        <div data-testid="vr-result" className="flex flex-col gap-3">
          <p className="text-center text-indigo-600 text-sm font-semibold">
            🏆 集體價值排名（共 {rankings.length} 人投票）
          </p>

          {rankings.length === 0 ? (
            <p data-testid="vr-empty" className="text-center text-gray-400 text-sm py-4">
              還沒有人送出排序
            </p>
          ) : (
            bordaResult.map(({ item, score }, idx) => (
              <div
                key={item}
                data-testid={`vr-result-${idx}`}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${RANK_COLORS[idx] ?? "bg-white border-gray-200"}`}
              >
                <span className="text-xl">{RANK_MEDALS[idx] ?? `#${idx + 1}`}</span>
                <span className="flex-1 text-sm font-semibold text-gray-700">{item}</span>
                <div className="flex flex-col items-end">
                  <span data-testid={`vr-score-${idx}`} className="text-xs font-bold text-indigo-600">
                    {score} pts
                  </span>
                  {maxScore > 0 && (
                    <div className="mt-1 h-1.5 w-20 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-400"
                        style={{ width: `${Math.round((score / maxScore) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* 個人排名明細 */}
          {showAuthor && rankings.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-400 mb-2 text-center">個人排序明細</p>
              {rankings.map((r) => (
                <div
                  key={r.entryId}
                  data-testid={`vr-voter-${r.entryId}`}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 mb-1 text-xs text-gray-600"
                >
                  <span className="font-semibold text-gray-700 mr-2">{r.userName}</span>
                  {r.order.map((it, i) => (
                    <span key={it}>
                      {i > 0 && <span className="text-gray-300 mx-1">›</span>}
                      {it}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
