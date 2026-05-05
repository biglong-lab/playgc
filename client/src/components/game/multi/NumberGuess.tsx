import React, { useState } from "react";

export interface NumberGuessConfig {
  title: string;
  question: string;
  unit?: string;
  minValue: number;
  maxValue: number;
  showAuthor: boolean;
}

export interface NumberEntry {
  entryId: string;
  userId: string;
  userName: string;
  value: number;
}

export interface NumberGuessState extends Record<string, unknown> {
  guesses: NumberEntry[];
  revealed: boolean;
}

interface Props {
  config: NumberGuessConfig;
  state: NumberGuessState;
  myUserId: string;
  draftValue: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

interface Stats {
  avg: number;
  median: number;
  min: number;
  max: number;
}

function computeStats(values: number[]): Stats {
  if (values.length === 0) return { avg: 0, median: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return { avg, median, min: sorted[0], max: sorted[sorted.length - 1] };
}

function buildHistogram(guesses: NumberEntry[]): { value: number; count: number; names: string[] }[] {
  const map: Record<number, { count: number; names: string[] }> = {};
  guesses.forEach((g) => {
    if (!map[g.value]) map[g.value] = { count: 0, names: [] };
    map[g.value].count += 1;
    map[g.value].names.push(g.userName);
  });
  return Object.entries(map)
    .map(([v, data]) => ({ value: Number(v), count: data.count, names: data.names }))
    .sort((a, b) => a.value - b.value);
}

export default function NumberGuess({
  config,
  state,
  myUserId,
  draftValue,
  onDraftChange,
  onSubmit,
  onReveal,
}: Props) {
  const { title, question, unit, minValue, maxValue, showAuthor } = config;
  const { guesses, revealed } = state;

  const myGuess = guesses.find((g) => g.userId === myUserId);
  const hasSubmitted = !!myGuess;

  const numVal = parseFloat(draftValue);
  const isValid = !isNaN(numVal) && numVal >= minValue && numVal <= maxValue;
  const canSubmit = isValid && !hasSubmitted;

  const histogram = revealed ? buildHistogram(guesses) : [];
  const stats = revealed ? computeStats(guesses.map((g) => g.value)) : null;
  const maxCount = histogram.length > 0 ? Math.max(...histogram.map((h) => h.count)) : 1;

  return (
    <div data-testid="ng-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="ng-title" className="text-lg font-bold text-center">{title}</h2>

      {/* 問題 */}
      <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4 text-center">
        <p data-testid="ng-question" className="text-base font-semibold text-indigo-700">{question}</p>
        {unit && (
          <p className="text-xs text-indigo-400 mt-1">
            範圍：{minValue} – {maxValue} {unit}
          </p>
        )}
      </div>

      {/* 輸入區 */}
      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-3 items-center">
            <input
              data-testid="ng-input"
              type="number"
              value={draftValue}
              onChange={(e) => onDraftChange(e.target.value)}
              min={minValue}
              max={maxValue}
              placeholder={`${minValue} – ${maxValue}`}
              className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center font-bold text-lg"
            />
            {unit && <span className="text-sm text-gray-500">{unit}</span>}
          </div>
          {draftValue.length > 0 && !isValid && (
            <p data-testid="ng-error" className="text-xs text-red-500 text-center">
              請輸入 {minValue} – {maxValue} 之間的數字
            </p>
          )}
          <button
            data-testid="ng-submit-btn"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors self-center"
          >
            送出猜測
          </button>
        </div>
      )}

      {/* 已送出 */}
      {hasSubmitted && !revealed && (
        <div data-testid="ng-submitted-msg" className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-center">
          <p className="text-sm font-semibold text-indigo-700">
            ✅ 你的答案：<span className="text-xl font-bold">{myGuess.value}</span>
            {unit && <span className="text-sm ml-1">{unit}</span>}
          </p>
          <p className="text-xs text-indigo-400 mt-1">等待所有人回答後揭曉</p>
        </div>
      )}

      {/* 揭曉控制 */}
      {!revealed && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            <span data-testid="ng-count">{guesses.length}</span> 人已回答
          </p>
          <button
            data-testid="ng-reveal-btn"
            onClick={onReveal}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            揭曉結果
          </button>
        </div>
      )}

      {/* 揭曉後：直方圖 + 統計 */}
      {revealed && (
        <div data-testid="ng-result" className="flex flex-col gap-3">
          <p className="text-center text-indigo-600 text-sm font-semibold">
            📊 共 {guesses.length} 人回答
          </p>

          {guesses.length === 0 ? (
            <p data-testid="ng-empty" className="text-center text-gray-400 text-sm py-4">
              還沒有人回答
            </p>
          ) : (
            <>
              {/* 統計卡片 */}
              {stats && (
                <div data-testid="ng-stats" className="grid grid-cols-4 gap-2">
                  {[
                    { label: "平均", value: stats.avg.toFixed(1), testid: "ng-avg" },
                    { label: "中位", value: stats.median.toFixed(1), testid: "ng-median" },
                    { label: "最低", value: stats.min.toString(), testid: "ng-min" },
                    { label: "最高", value: stats.max.toString(), testid: "ng-max" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-indigo-50 border border-indigo-200 p-2 text-center">
                      <p className="text-xs text-indigo-400">{stat.label}</p>
                      <p data-testid={stat.testid} className="text-sm font-bold text-indigo-700">
                        {stat.value}
                        {unit && <span className="text-xs ml-0.5">{unit}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* 直方圖 */}
              <div className="flex flex-col gap-1">
                {histogram.map(({ value, count, names }) => (
                  <div
                    key={value}
                    data-testid={`ng-bar-${value}`}
                    className="flex items-center gap-2"
                  >
                    <span className="text-xs font-bold text-indigo-600 w-12 text-right">
                      {value}{unit ? ` ${unit}` : ""}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full overflow-hidden h-5">
                      <div
                        className="h-full bg-indigo-400 rounded-full transition-all"
                        style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-6 text-left">×{count}</span>
                    {showAuthor && (
                      <span className="text-xs text-gray-400">{names.join(", ")}</span>
                    )}
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
