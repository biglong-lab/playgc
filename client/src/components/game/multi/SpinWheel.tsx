import { useState } from "react";

export interface SpinEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  label: string;
}

export interface SpinWheelConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  allowPlayerAdd: boolean;
}

export interface SpinWheelState extends Record<string, unknown> {
  entries: SpinEntry[];
  results: string[];
}

const DEFAULT_CONFIG: SpinWheelConfig = {
  title: "幸運轉盤",
  prompt: "把你的名字加入轉盤，看誰幸運被選中！",
  allowPlayerAdd: true,
};

interface Props {
  config: SpinWheelConfig;
  state: SpinWheelState;
  myUserId: string;
  onAddEntry: (label: string) => void;
  onSpin: () => void;
  onRemoveEntry: (entryId: string) => void;
}

export default function SpinWheel({
  config,
  state,
  myUserId,
  onAddEntry,
  onSpin,
  onRemoveEntry,
}: Props) {
  const [inputVal, setInputVal] = useState("");

  const allowPlayerAdd =
    config.allowPlayerAdd ?? DEFAULT_CONFIG.allowPlayerAdd;
  const { entries, results } = state;

  const lastResult = results.length > 0 ? results[results.length - 1] : null;
  const canAdd = inputVal.trim().length > 0 && allowPlayerAdd;

  function handleAdd() {
    if (!canAdd) return;
    onAddEntry(inputVal.trim());
    setInputVal("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2
        data-testid="sw-title"
        className="text-xl font-bold text-center"
      >
        {config.title || DEFAULT_CONFIG.title}
      </h2>
      <p
        data-testid="sw-prompt"
        className="text-center text-gray-600 text-sm"
      >
        {config.prompt || DEFAULT_CONFIG.prompt}
      </p>

      {allowPlayerAdd && (
        <div className="flex gap-2">
          <input
            data-testid="sw-add-input"
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="輸入你的名字或項目"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <button
            data-testid="sw-add-btn"
            onClick={handleAdd}
            disabled={!canAdd}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-violet-700"
          >
            加入
          </button>
        </div>
      )}

      {lastResult && (
        <div
          data-testid="sw-result"
          className="text-center p-4 bg-yellow-50 border-2 border-yellow-400 rounded-xl"
        >
          <p className="text-xs text-yellow-600 mb-1">🎉 中獎！</p>
          <p
            data-testid="sw-result-label"
            className="text-2xl font-bold text-yellow-800"
          >
            {lastResult}
          </p>
        </div>
      )}

      {entries.length === 0 ? (
        <div
          data-testid="sw-empty"
          className="text-center text-gray-400 py-6"
        >
          尚無項目，先加入名字吧！
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            目前 {entries.length} 個項目：
          </p>
          {entries.map((entry) => (
            <div
              key={entry.entryId}
              data-testid={`sw-entry-${entry.entryId}`}
              className={`flex items-center justify-between p-2 rounded-lg border ${
                lastResult === entry.label
                  ? "border-yellow-400 bg-yellow-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <span className="text-sm">{entry.label}</span>
              {entry.userId === myUserId && (
                <button
                  data-testid={`sw-remove-${entry.entryId}`}
                  onClick={() => onRemoveEntry(entry.entryId)}
                  className="text-xs text-gray-400 hover:text-red-500 ml-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        <button
          data-testid="sw-spin-btn"
          onClick={onSpin}
          disabled={entries.length === 0}
          className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold text-lg disabled:opacity-40 hover:bg-violet-700 disabled:cursor-not-allowed"
        >
          🎡 轉動！
        </button>
        {results.length > 0 && (
          <p
            data-testid="sw-history"
            className="text-xs text-gray-400"
          >
            已轉 {results.length} 次
          </p>
        )}
      </div>
    </div>
  );
}
