import { useState } from "react";

export interface ColumnItem extends Record<string, unknown> {
  itemId: string;
  userId: string;
  userName: string;
  text: string;
  column: "left" | "right";
}

export interface TwoColumnConfig extends Record<string, unknown> {
  title: string;
  leftLabel: string;
  rightLabel: string;
  maxLength: number;
}

export interface TwoColumnState extends Record<string, unknown> {
  items: ColumnItem[];
  revealed: boolean;
}

const DEFAULT_CONFIG: TwoColumnConfig = {
  title: "雙欄分類",
  leftLabel: "優點",
  rightLabel: "缺點",
  maxLength: 60,
};

interface Props {
  config: TwoColumnConfig;
  state: TwoColumnState;
  myUserId: string;
  onSubmit: (text: string, column: "left" | "right") => void;
  onReveal: () => void;
}

export default function TwoColumn({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
}: Props) {
  const [input, setInput] = useState("");
  const [activeColumn, setActiveColumn] = useState<"left" | "right">("left");

  const { title, leftLabel, rightLabel, maxLength } = config || DEFAULT_CONFIG;
  const { items, revealed } = state;

  const myItems = items.filter((i) => i.userId === myUserId);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed, activeColumn);
    setInput("");
  }

  const leftItems = items.filter((i) => i.column === "left");
  const rightItems = items.filter((i) => i.column === "right");

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="tc-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      {!revealed && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              data-testid="tc-col-left"
              onClick={() => setActiveColumn("left")}
              className={`py-2 rounded-xl border text-sm font-semibold transition-colors ${
                activeColumn === "left"
                  ? "bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-blue-200"
                  : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {leftLabel}
            </button>
            <button
              data-testid="tc-col-right"
              onClick={() => setActiveColumn("right")}
              className={`py-2 rounded-xl border text-sm font-semibold transition-colors ${
                activeColumn === "right"
                  ? "bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-200"
                  : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {rightLabel}
            </button>
          </div>

          <div className="flex gap-2">
            <input
              data-testid="tc-input"
              type="text"
              value={input}
              onChange={(e) => {
                if (e.target.value.length <= maxLength) setInput(e.target.value);
              }}
              placeholder={`新增${activeColumn === "left" ? leftLabel : rightLabel}...`}
              className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              data-testid="tc-submit-btn"
              onClick={handleSubmit}
              disabled={input.trim().length === 0}
              className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 disabled:opacity-40"
            >
              新增
            </button>
          </div>

          {myItems.length > 0 && (
            <div data-testid="tc-my-items" className="space-y-1">
              <p className="text-xs text-gray-400">你已新增 {myItems.length} 筆</p>
            </div>
          )}

          <p className="text-xs text-center text-gray-400">
            共 <span data-testid="tc-count">{items.length}</span> 筆内容
          </p>

          <div className="text-center">
            <button
              data-testid="tc-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布所有内容
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div data-testid="tc-result" className="space-y-3">
          {items.length === 0 ? (
            <div data-testid="tc-empty" className="text-center text-gray-400 py-8">
              尚無任何内容
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div data-testid="tc-result-left" className="space-y-1">
                <p className="text-xs font-semibold text-blue-600 text-center">
                  {leftLabel}（{leftItems.length}）
                </p>
                {leftItems.map((item) => (
                  <div
                    key={item.itemId}
                    data-testid={`tc-item-${item.itemId}`}
                    className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800"
                  >
                    {item.text}
                  </div>
                ))}
              </div>
              <div data-testid="tc-result-right" className="space-y-1">
                <p className="text-xs font-semibold text-rose-600 text-center">
                  {rightLabel}（{rightItems.length}）
                </p>
                {rightItems.map((item) => (
                  <div
                    key={item.itemId}
                    data-testid={`tc-item-${item.itemId}`}
                    className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800"
                  >
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
