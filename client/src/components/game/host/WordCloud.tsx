// 💬 WordCloud — HostScreen 即時字雲元件（W18 D3）
//
// 設計依據：docs/decisions/0013-w18-component-expansion.md
// pageType: host_word_cloud
//
// 玩法：
//   - 大螢幕：玩家送詞、字雲即時長出、重複詞越大、新詞動畫掉下來
//   - 玩家端：輸入框送詞（單詞 / 短句）+ 看自己已送過的
//   - 適用：婚禮新人特質、同學會記憶詞、內訓回饋、派對開場暖身
//
// state 結構：
//   {
//     wordCounts: Record<word, number>;  // 詞 → 累計次數
//     totalSubmissions: number;          // 總送詞數
//     recentWords: { word, ts }[];       // 最近 N 個（給動畫）
//     submitters: Record<userId, number>; // 各玩家送詞次數
//   }
//
// pulse 結構：
//   { type: "submit", payload: { word, userId } }

import { useEffect, useMemo, useState } from "react";

const DEFAULT_MAX_WORDS_PER_USER = 3;
const DEFAULT_MAX_LENGTH = 10;
const ANIM_DURATION_MS = 2500;
const MAX_RECENT_WORDS = 20;

export interface WordCloudConfig {
  title?: string;
  subtitle?: string;
  /** 每位玩家最多送幾次（預設 3）*/
  maxWordsPerUser?: number;
  /** 單詞最大長度（預設 10 字元）*/
  maxLength?: number;
}

interface RecentWord {
  word: string;
  ts: number;
  /** 隨機 X 位置（0-90 %）*/
  x: number;
}

export interface WordCloudState {
  wordCounts: Record<string, number>;
  totalSubmissions: number;
  recentWords: RecentWord[];
  submitters: Record<string, number>;
}

export interface WordCloudProps {
  config: WordCloudConfig;
  hostMode: boolean;
  state?: WordCloudState | null;
  onPulse?: (pulseType: string, payload: { word?: string; userId?: string }) => void;
  onBroadcastState?: (state: WordCloudState) => void;
}

export function buildInitialWordCloudState(): WordCloudState {
  return {
    wordCounts: {},
    totalSubmissions: 0,
    recentWords: [],
    submitters: {},
  };
}

/**
 * 計算詞的字體大小（純函式、易測試）
 *
 * 公式：fontSize = baseSize + min(count * 8, maxBoost)
 * - count=1 → 24px
 * - count=2 → 32px
 * - count=5 → 56px
 * - count=10+ → 96px max
 */
export function calculateWordSize(count: number): number {
  const baseSize = 24;
  const maxBoost = 72;
  const boost = Math.min(count * 8, maxBoost);
  return baseSize + boost;
}

/**
 * 把詞雲狀態整理成「依詞頻排序的可視陣列」（純函式、易測試）
 */
export function getSortedWords(
  wordCounts: Record<string, number>,
): { word: string; count: number; size: number }[] {
  return Object.entries(wordCounts)
    .map(([word, count]) => ({ word, count, size: calculateWordSize(count) }))
    .sort((a, b) => b.count - a.count);
}

export default function WordCloud({ config, hostMode, state, onPulse }: WordCloudProps) {
  const maxLength = config.maxLength ?? DEFAULT_MAX_LENGTH;
  const maxWordsPerUser = config.maxWordsPerUser ?? DEFAULT_MAX_WORDS_PER_USER;
  const effectiveState = state ?? buildInitialWordCloudState();

  // host 端：tick 用於清掃過期動畫詞
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!hostMode) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [hostMode]);

  // 玩家端 input
  const [inputValue, setInputValue] = useState("");
  const playerName =
    (typeof window !== "undefined" && localStorage.getItem("chitoUserName")) || "";
  const myCount = playerName ? effectiveState.submitters[playerName] ?? 0 : 0;
  const reachedLimit = myCount >= maxWordsPerUser;

  const sortedWords = useMemo(
    () => getSortedWords(effectiveState.wordCounts),
    [effectiveState.wordCounts],
  );

  const visibleAnimating = effectiveState.recentWords.filter(
    (w) => now - w.ts < ANIM_DURATION_MS,
  );

  // ─── 大螢幕版型 ───
  if (hostMode) {
    return (
      <div className="w-full h-full min-h-screen relative overflow-hidden bg-gradient-to-br from-purple-900 via-violet-900 to-indigo-900 text-white">
        {/* 動畫層：新詞往下掉 */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {visibleAnimating.map((w) => {
            const elapsed = now - w.ts;
            const progress = elapsed / ANIM_DURATION_MS;
            const yOffset = progress * 30; // 0 → 30vh
            const opacity = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.7) / 0.3;
            const scale = 0.8 + progress * 0.4;
            return (
              <div
                key={`${w.word}-${w.ts}`}
                className="absolute text-yellow-300 font-bold drop-shadow-lg"
                style={{
                  left: `${w.x}%`,
                  top: `${10 + yOffset}vh`,
                  opacity: Math.max(0, opacity),
                  transform: `scale(${scale})`,
                  fontSize: "3rem",
                  transition: "none",
                }}
                data-testid="word-cloud-animating"
              >
                {w.word}
              </div>
            );
          })}
        </div>

        <div className="relative z-20 flex flex-col items-center px-8 pt-12">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-center mb-2">
            💬 {config.title ?? "字雲"}
          </h1>
          {config.subtitle && (
            <p className="text-base md:text-xl text-purple-200 text-center mb-2">
              {config.subtitle}
            </p>
          )}
          <div className="text-purple-300 text-sm mb-8">
            共 <span className="font-bold text-yellow-200 text-lg">{effectiveState.totalSubmissions}</span> 次送詞
          </div>

          {/* 字雲展示 */}
          {sortedWords.length === 0 ? (
            <div className="text-2xl text-purple-300 mt-12">
              等待玩家送詞...
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-3 justify-center items-center max-w-6xl mx-auto px-4">
              {sortedWords.map(({ word, count, size }, idx) => {
                const colors = [
                  "text-yellow-300",
                  "text-pink-300",
                  "text-cyan-300",
                  "text-emerald-300",
                  "text-orange-300",
                  "text-violet-300",
                ];
                const color = colors[idx % colors.length];
                return (
                  <span
                    key={word}
                    className={`${color} font-bold inline-block transition-all`}
                    style={{
                      fontSize: `${size}px`,
                      lineHeight: 1.1,
                    }}
                    data-testid={`word-${word}`}
                    title={`${word} ×${count}`}
                  >
                    {word}
                    {count > 1 && (
                      <span className="text-purple-200 text-xs ml-1 align-top">×{count}</span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 玩家版型 ───
  const handleSubmit = () => {
    const word = inputValue.trim().slice(0, maxLength);
    if (!word) return;
    if (!playerName) {
      alert("請先設定玩家名稱");
      return;
    }
    if (reachedLimit) return;
    onPulse?.("submit", { word, userId: playerName });
    setInputValue("");
  };

  return (
    <div className="w-full p-4 max-w-md mx-auto space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">💬 {config.title ?? "字雲"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      {/* 已用次數 */}
      <div className="text-center text-sm text-muted-foreground">
        已送 {myCount} / {maxWordsPerUser} 個詞
      </div>

      {/* 輸入區 */}
      <div className="bg-card rounded-xl p-4 border-2 border-border space-y-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.slice(0, maxLength))}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={reachedLimit}
          placeholder={reachedLimit ? "已達送詞上限" : `打一個詞（最多 ${maxLength} 字）`}
          className="w-full px-4 py-3 text-lg rounded-lg border-2 border-border bg-background focus:border-purple-500 focus:outline-none disabled:opacity-50"
          data-testid="input-word"
          maxLength={maxLength}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!inputValue.trim() || reachedLimit}
          className="w-full py-3 bg-purple-600 text-white rounded-lg font-bold shadow-md hover:bg-purple-700 active:scale-95 transition-all disabled:bg-zinc-300 disabled:text-zinc-500"
          data-testid="btn-word-submit"
        >
          {reachedLimit ? "🎯 已達上限" : "💬 送出"}
        </button>
      </div>

      {/* 全場熱詞 top 5 */}
      {sortedWords.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-950 rounded-xl p-3">
          <div className="text-xs text-purple-700 dark:text-purple-300 mb-2">🔥 全場熱詞</div>
          <div className="flex flex-wrap gap-2">
            {sortedWords.slice(0, 5).map(({ word, count }) => (
              <span
                key={word}
                className="px-3 py-1 bg-purple-200 dark:bg-purple-800 rounded-full text-sm font-medium"
              >
                {word} ×{count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
