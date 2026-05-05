import React from "react";

export interface DesertIslandConfig extends Record<string, unknown> {
  title: string;
  scenario: string;
  numItems: number;
  maxItemLength: number;
  showAuthor: boolean;
}

export interface DesertEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  items: string[];
}

export interface DesertIslandState extends Record<string, unknown> {
  entries: DesertEntry[];
  revealed: boolean;
}

interface Props {
  config: DesertIslandConfig;
  state: DesertIslandState;
  myUserId: string;
  draftItems: string[];
  onDraftChange: (idx: number, value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

export default function DesertIsland({
  config,
  state,
  myUserId,
  draftItems,
  onDraftChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, scenario, numItems, maxItemLength, showAuthor } = config;
  const { entries, revealed } = state;

  const myEntry = entries.find((e) => e.userId === myUserId);
  const allFilled = draftItems.length === numItems && draftItems.every((v) => v.trim().length > 0);
  const hasError = draftItems.some((v) => v.length > maxItemLength);

  return (
    <div data-testid="di-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="di-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p data-testid="di-scenario" className="text-sm text-center text-gray-600 bg-gray-50 p-3 rounded-xl">
        {scenario}
      </p>

      <div data-testid="di-count" className="text-center text-sm text-gray-500">
        已有 <span className="font-semibold text-indigo-600">{entries.length}</span> 人作答
      </div>

      {!myEntry && !revealed && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: numItems }, (_, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-sm font-bold text-indigo-500 w-5">{idx + 1}.</span>
              <input
                data-testid={`di-item-input-${idx}`}
                type="text"
                value={draftItems[idx] ?? ""}
                onChange={(e) => onDraftChange(idx, e.target.value)}
                maxLength={maxItemLength + 5}
                placeholder={`第 ${idx + 1} 樣`}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          ))}
          {hasError && (
            <p data-testid="di-error" className="text-xs text-red-500 text-center">
              每項最多 {maxItemLength} 字
            </p>
          )}
          <button
            data-testid="di-submit-btn"
            onClick={onSubmit}
            disabled={!allFilled || hasError}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送出我的清單
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div
          data-testid="di-submitted-msg"
          className="p-3 bg-green-50 rounded-xl border border-green-200 text-center"
        >
          <div className="text-green-700 font-semibold mb-1">✅ 已送出！等待揭曉</div>
          <div className="text-sm text-gray-600">
            {myEntry.items.map((item, i) => (
              <span key={i} className="inline-block bg-white border border-gray-200 rounded-full px-2 py-0.5 m-0.5 text-xs">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {!revealed ? (
        <button
          data-testid="di-reveal-btn"
          onClick={onReveal}
          className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600"
        >
          揭曉大家的選擇
        </button>
      ) : (
        <div data-testid="di-result" className="flex flex-col gap-3">
          {entries.length === 0 ? (
            <div data-testid="di-empty" className="text-center text-gray-400 p-8">
              還沒有人作答
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.entryId}
                data-testid={`di-entry-${entry.entryId}`}
                className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm"
              >
                {showAuthor && (
                  <div className="text-xs text-gray-500 mb-2 font-semibold">{entry.userName}</div>
                )}
                <div className="flex flex-wrap gap-1">
                  {entry.items.map((item, i) => (
                    <span
                      key={i}
                      data-testid={`di-entry-item-${entry.entryId}-${i}`}
                      className="inline-block bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5 text-xs text-indigo-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
