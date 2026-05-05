import { useState } from "react";

export interface RankItem extends Record<string, unknown> {
  itemId: string;
  label: string;
}

export interface PlayerRanking extends Record<string, unknown> {
  rankingId: string;
  userId: string;
  userName: string;
  order: string[];
}

export interface RankChoiceConfig extends Record<string, unknown> {
  title: string;
  question: string;
  items: RankItem[];
}

export interface RankChoiceState extends Record<string, unknown> {
  rankings: PlayerRanking[];
  revealed: boolean;
}

const DEFAULT_CONFIG: RankChoiceConfig = {
  title: "排序投票",
  question: "請依你的偏好排列順序",
  items: [],
};

interface Props {
  config: RankChoiceConfig;
  state: RankChoiceState;
  myUserId: string;
  onSubmit: (order: string[]) => void;
  onReveal: () => void;
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function computeBorda(
  items: RankItem[],
  rankings: PlayerRanking[]
): { itemId: string; label: string; score: number }[] {
  const n = items.length;
  const scoreMap: Record<string, number> = {};
  for (const item of items) scoreMap[item.itemId] = 0;
  for (const ranking of rankings) {
    ranking.order.forEach((itemId, idx) => {
      scoreMap[itemId] = (scoreMap[itemId] ?? 0) + (n - 1 - idx);
    });
  }
  return items
    .map((item) => ({ itemId: item.itemId, label: item.label, score: scoreMap[item.itemId] ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

export default function RankChoice({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
}: Props) {
  const items = config.items ?? DEFAULT_CONFIG.items;
  const [localOrder, setLocalOrder] = useState<string[]>(() =>
    items.map((i) => i.itemId)
  );

  const { rankings, revealed } = state;
  const title = config.title || DEFAULT_CONFIG.title;
  const question = config.question || DEFAULT_CONFIG.question;

  const myRanking = rankings.find((r) => r.userId === myUserId);
  const bordaResults = revealed ? computeBorda(items, rankings) : [];
  const topItemId = bordaResults[0]?.itemId ?? null;

  const labelFor = (itemId: string) =>
    items.find((i) => i.itemId === itemId)?.label ?? itemId;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="rc-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p
        data-testid="rc-question"
        className="text-base text-center p-4 bg-violet-50 rounded-xl font-medium"
      >
        {question}
      </p>

      {items.length === 0 && (
        <p data-testid="rc-empty" className="text-center text-gray-400 py-8">
          尚未設定排序項目
        </p>
      )}

      {items.length > 0 && !revealed && (
        <>
          {!myRanking ? (
            <div className="space-y-3">
              <p className="text-xs text-center text-gray-400">
                用上下按鈕調整排序，第一名最佳
              </p>
              <div className="space-y-2">
                {localOrder.map((itemId, idx) => (
                  <div
                    key={itemId}
                    data-testid={`rc-item-${itemId}`}
                    className="flex items-center gap-2 p-3 bg-white border-2 border-gray-200 rounded-xl"
                  >
                    <span className="text-sm font-bold text-violet-600 w-5 shrink-0">
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm">{labelFor(itemId)}</span>
                    <div className="flex gap-1">
                      <button
                        data-testid={`rc-up-${itemId}`}
                        onClick={() =>
                          idx > 0 && setLocalOrder(move(localOrder, idx, idx - 1))
                        }
                        disabled={idx === 0}
                        className="px-2 py-1 text-xs border rounded disabled:opacity-30 hover:bg-gray-50"
                      >
                        ↑
                      </button>
                      <button
                        data-testid={`rc-down-${itemId}`}
                        onClick={() =>
                          idx < localOrder.length - 1 &&
                          setLocalOrder(move(localOrder, idx, idx + 1))
                        }
                        disabled={idx === localOrder.length - 1}
                        className="px-2 py-1 text-xs border rounded disabled:opacity-30 hover:bg-gray-50"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <button
                  data-testid="rc-submit-btn"
                  onClick={() => onSubmit(localOrder)}
                  className="px-8 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700"
                >
                  提交排序
                </button>
              </div>
            </div>
          ) : (
            <p data-testid="rc-submitted" className="text-center text-sm text-gray-500">
              ✅ 已提交排序
            </p>
          )}
          <p className="text-xs text-center text-gray-400">
            已有 <span data-testid="rc-count">{rankings.length}</span> 人提交
          </p>
          <div className="text-center">
            <button
              data-testid="rc-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布結果
            </button>
          </div>
        </>
      )}

      {revealed && (
        <div className="space-y-3">
          {rankings.length === 0 ? (
            <div data-testid="rc-result-empty" className="text-center text-gray-400 py-8">
              尚無提交
            </div>
          ) : (
            <>
              {topItemId && (
                <p
                  data-testid="rc-winner"
                  className="text-center text-sm font-semibold text-yellow-700"
                >
                  🏆 集體最優先：{labelFor(topItemId)}
                </p>
              )}
              <div className="space-y-2">
                <p className="text-xs text-center text-gray-400">
                  Borda 積分排名（{rankings.length} 人參與）
                </p>
                {bordaResults.map((r, rank) => (
                  <div
                    key={r.itemId}
                    data-testid={`rc-result-${r.itemId}`}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      rank === 0
                        ? "border-yellow-400 bg-yellow-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <span className="text-sm">
                      {rank === 0 && "🏆 "}#{rank + 1} {r.label}
                    </span>
                    <span
                      data-testid={`rc-score-${r.itemId}`}
                      className="text-sm font-bold text-violet-700"
                    >
                      {r.score} 分
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
