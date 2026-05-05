import { useState } from "react";

export interface WordEntry extends Record<string, unknown> {
  wordId: string;
  userId: string;
  userName: string;
  words: string[];
}

export interface WordCloudConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxWords: number;
  maxWordLength: number;
  showAuthor: boolean;
}

export interface WordCloudState extends Record<string, unknown> {
  entries: WordEntry[];
  revealed: boolean;
}

const DEFAULT_CONFIG: WordCloudConfig = {
  title: "文字雲",
  prompt: "用一到三個詞描述現在的心情",
  maxWords: 3,
  maxWordLength: 10,
  showAuthor: false,
};

interface Props {
  config: WordCloudConfig;
  state: WordCloudState;
  myUserId: string;
  onSubmit: (words: string[]) => void;
  onReveal: () => void;
}

export default function WordCloud({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
}: Props) {
  const [inputs, setInputs] = useState<string[]>([""]);

  const maxWords = config.maxWords ?? DEFAULT_CONFIG.maxWords;
  const maxWordLength = config.maxWordLength ?? DEFAULT_CONFIG.maxWordLength;
  const showAuthor = config.showAuthor ?? DEFAULT_CONFIG.showAuthor;
  const { entries, revealed } = state;

  const myEntry = entries.find((e) => e.userId === myUserId);

  const freqMap: Record<string, number> = {};
  for (const entry of entries) {
    for (const w of entry.words) {
      const key = w.trim().toLowerCase();
      if (key) freqMap[key] = (freqMap[key] ?? 0) + 1;
    }
  }
  const maxFreq = Math.max(1, ...Object.values(freqMap));
  const sortedWords = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);

  const hasOverLength = inputs.some((w) => w.length > maxWordLength);
  const validWords = inputs.map((w) => w.trim()).filter(Boolean);
  const canSubmit = validWords.length > 0 && !hasOverLength && !myEntry;

  function handleInputChange(idx: number, val: string) {
    const next = [...inputs];
    next[idx] = val;
    if (idx === next.length - 1 && val.trim() && next.length < maxWords) {
      next.push("");
    }
    setInputs(next);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(validWords);
    setInputs([""]);
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2
        data-testid="wc-title"
        className="text-xl font-bold text-center"
      >
        {config.title || DEFAULT_CONFIG.title}
      </h2>
      <p
        data-testid="wc-prompt"
        className="text-center text-gray-600 text-sm"
      >
        {config.prompt || DEFAULT_CONFIG.prompt}
      </p>

      {!myEntry && (
        <div className="space-y-2">
          {inputs.map((val, idx) => (
            <input
              key={idx}
              data-testid={`wc-word-input-${idx}`}
              type="text"
              value={val}
              onChange={(e) => handleInputChange(idx, e.target.value)}
              placeholder={idx === 0 ? "輸入詞語" : "再加一個（選填）"}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          ))}
          {hasOverLength && (
            <p
              data-testid="wc-word-error"
              className="text-xs text-red-500"
            >
              詞語過長（每個最多 {maxWordLength} 字）
            </p>
          )}
          <div className="flex justify-end">
            <button
              data-testid="wc-submit-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-violet-700 disabled:cursor-not-allowed"
            >
              送出
            </button>
          </div>
        </div>
      )}

      {myEntry && (
        <p
          data-testid="wc-submitted-msg"
          className="text-center text-sm text-green-600"
        >
          ✅ 已送出：{myEntry.words.join("、")}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p data-testid="wc-count" className="text-xs text-gray-400">
          已送出：{entries.length} 人
        </p>
        {!revealed && (
          <button
            data-testid="wc-reveal-btn"
            onClick={onReveal}
            className="px-3 py-1 text-sm bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200"
          >
            揭曉文字雲
          </button>
        )}
      </div>

      {revealed && sortedWords.length === 0 && (
        <div
          data-testid="wc-empty"
          className="text-center text-gray-400 py-8"
        >
          尚無詞語
        </div>
      )}

      {revealed && sortedWords.length > 0 && (
        <div
          data-testid="wc-cloud"
          className="flex flex-wrap gap-2 justify-center py-4"
        >
          {sortedWords.map(([word, freq]) => {
            const level = Math.ceil((freq / maxFreq) * 3);
            const sizeClass =
              level === 3
                ? "text-2xl font-bold"
                : level === 2
                ? "text-lg font-semibold"
                : "text-sm";
            return (
              <span
                key={word}
                data-testid={`wc-word-${word}`}
                data-freq={freq}
                className={`px-2 py-1 rounded-full bg-violet-100 text-violet-800 ${sizeClass}`}
              >
                {word}
                {freq > 1 && (
                  <span
                    data-testid={`wc-freq-${word}`}
                    className="ml-1 text-xs text-violet-400"
                  >
                    ×{freq}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {revealed && showAuthor && (
        <div className="space-y-1">
          {entries.map((entry) => (
            <p
              key={entry.userId}
              data-testid={`wc-author-${entry.userId}`}
              className="text-xs text-gray-400 text-center"
            >
              {entry.userName}：{entry.words.join("、")}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
