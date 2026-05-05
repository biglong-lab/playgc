import React, { useState } from "react";

export interface CategoryChallengeConfig extends Record<string, unknown> {
  title: string;
  category: string;
  prompt: string;
  maxItemsPerPerson: number;
  maxItemLength: number;
  showCommon: boolean;
}

export interface CategorySubmission extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  items: string[];
}

export interface CategoryChallengeState extends Record<string, unknown> {
  submissions: CategorySubmission[];
  revealed: boolean;
}

interface Props {
  config: CategoryChallengeConfig;
  state: CategoryChallengeState;
  myUserId: string;
  onSubmit: (items: string[]) => void;
  onReveal: () => void;
}

function findCommonItems(submissions: CategorySubmission[]): Set<string> {
  const counts: Record<string, number> = {};
  for (const sub of submissions) {
    const seen = new Set<string>();
    for (const item of sub.items) {
      const key = item.trim().toLowerCase();
      if (key && !seen.has(key)) {
        counts[key] = (counts[key] ?? 0) + 1;
        seen.add(key);
      }
    }
  }
  return new Set(Object.entries(counts).filter(([, n]) => n >= 2).map(([k]) => k));
}

export default function CategoryChallenge({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
}: Props) {
  const { title, category, prompt, maxItemsPerPerson, maxItemLength, showCommon } = config;
  const { submissions, revealed } = state;

  const [draftInput, setDraftInput] = useState("");
  const [localItems, setLocalItems] = useState<string[]>([]);

  const mySubmission = submissions.find((s) => s.userId === myUserId);
  const commonItems = revealed && showCommon ? findCommonItems(submissions) : new Set<string>();

  function handleAdd() {
    const trimmed = draftInput.trim();
    if (!trimmed || trimmed.length > maxItemLength) return;
    if (localItems.includes(trimmed)) return;
    if (localItems.length >= maxItemsPerPerson) return;
    setLocalItems((prev) => [...prev, trimmed]);
    setDraftInput("");
  }

  function handleRemove(item: string) {
    setLocalItems((prev) => prev.filter((i) => i !== item));
  }

  function handleSubmit() {
    if (localItems.length === 0) return;
    onSubmit(localItems);
    setLocalItems([]);
    setDraftInput("");
  }

  const isOverLength = draftInput.trim().length > maxItemLength;
  const canAdd = draftInput.trim().length > 0 && !isOverLength && localItems.length < maxItemsPerPerson;

  return (
    <div data-testid="cc-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="cc-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <div
        data-testid="cc-category"
        className="text-center p-3 bg-indigo-50 rounded-xl border border-indigo-200 font-semibold text-indigo-800"
      >
        {category}
      </div>
      <p data-testid="cc-prompt" className="text-sm text-center text-gray-600">
        {prompt}
      </p>

      <div data-testid="cc-count" className="text-center text-sm text-gray-500">
        已有 <span className="font-semibold text-indigo-600">{submissions.length}</span> 人提交
      </div>

      {!mySubmission && !revealed && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              data-testid="cc-item-input"
              type="text"
              value={draftInput}
              onChange={(e) => setDraftInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canAdd && handleAdd()}
              placeholder="輸入一個項目…"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              data-testid="cc-add-btn"
              onClick={handleAdd}
              disabled={!canAdd}
              className="px-4 py-2 bg-indigo-500 text-white text-sm font-semibold rounded-lg hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              加入
            </button>
          </div>
          {isOverLength && (
            <p data-testid="cc-error" className="text-xs text-red-500 text-center">
              最多 {maxItemLength} 字
            </p>
          )}

          {localItems.length > 0 && (
            <div data-testid="cc-local-list" className="flex flex-wrap gap-1 p-2 bg-gray-50 rounded-lg">
              {localItems.map((item, i) => (
                <span
                  key={i}
                  data-testid={`cc-local-item-${i}`}
                  className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2 py-0.5 text-xs"
                >
                  {item}
                  <button
                    onClick={() => handleRemove(item)}
                    className="text-gray-400 hover:text-red-500 font-bold ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <button
            data-testid="cc-submit-btn"
            onClick={handleSubmit}
            disabled={localItems.length === 0}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送出 {localItems.length > 0 ? `（${localItems.length} 項）` : ""}
          </button>
        </div>
      )}

      {mySubmission && !revealed && (
        <div
          data-testid="cc-submitted-msg"
          className="p-3 bg-green-50 rounded-xl border border-green-200 text-center"
        >
          <div className="text-green-700 font-semibold">✅ 已提交 {mySubmission.items.length} 項！</div>
        </div>
      )}

      {!revealed ? (
        <button
          data-testid="cc-reveal-btn"
          onClick={onReveal}
          className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600"
        >
          揭曉所有人的答案
        </button>
      ) : (
        <div data-testid="cc-result" className="flex flex-col gap-3">
          {submissions.length === 0 ? (
            <div data-testid="cc-empty" className="text-center text-gray-400 p-8">
              沒有人提交答案
            </div>
          ) : (
            submissions.map((sub) => (
              <div
                key={sub.entryId}
                data-testid={`cc-submission-${sub.entryId}`}
                className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm"
              >
                <div className="text-xs text-gray-500 mb-2 font-semibold">{sub.userName}</div>
                <div className="flex flex-wrap gap-1">
                  {sub.items.map((item, i) => {
                    const isCommon = commonItems.has(item.trim().toLowerCase());
                    return (
                      <span
                        key={i}
                        data-testid={`cc-item-${sub.entryId}-${i}`}
                        className={`inline-block rounded-full px-2 py-0.5 text-xs border ${
                          isCommon
                            ? "bg-yellow-50 border-yellow-300 text-yellow-800 font-semibold"
                            : "bg-gray-50 border-gray-200 text-gray-700"
                        }`}
                      >
                        {isCommon && "⭐ "}{item}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          {showCommon && commonItems.size > 0 && (
            <div data-testid="cc-common-section" className="p-3 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="text-xs font-semibold text-yellow-700 mb-1">⭐ 多人共同選擇</div>
              <div className="flex flex-wrap gap-1">
                {Array.from(commonItems).map((item) => (
                  <span
                    key={item}
                    data-testid={`cc-common-${item}`}
                    className="inline-block bg-yellow-100 border border-yellow-300 rounded-full px-2 py-0.5 text-xs text-yellow-800"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
