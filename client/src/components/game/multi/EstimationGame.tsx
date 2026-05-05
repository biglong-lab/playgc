import { Eye, CheckCircle2, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EstimationGameConfig {
  title: string;
  question: string;
  unit?: string;
  options?: string[];
  showAverage: boolean;
  showAllEstimates: boolean;
}

export interface EstimationEntry {
  userId: string;
  userName: string;
  value: string;
  submittedAt: number;
}

export interface EstimationGameState extends Record<string, unknown> {
  entries: EstimationEntry[];
  revealed: boolean;
}

interface Props {
  config: EstimationGameConfig;
  state: EstimationGameState;
  myUserId: string;
  localValue: string;
  onSelectValue: (value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
}

const FIBONACCI_OPTIONS = ["1", "2", "3", "5", "8", "13", "21", "?"];
const TSHIRT_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "?"];

function computeStats(entries: EstimationEntry[]) {
  const nums = entries
    .map((e) => parseFloat(e.value))
    .filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return { avg: avg.toFixed(1), min, max };
}

function computeDistribution(entries: EstimationEntry[], options: string[]) {
  const counts: Record<string, number> = {};
  for (const opt of options) counts[opt] = 0;
  for (const e of entries) {
    if (counts[e.value] !== undefined) counts[e.value]++;
  }
  return counts;
}

export default function EstimationGame({
  config,
  state,
  myUserId,
  localValue,
  onSelectValue,
  onSubmit,
  onReveal,
}: Props) {
  const { title, question, unit, options, showAverage, showAllEstimates } = config;
  const { entries, revealed } = state;

  const myEntry = entries.find((e) => e.userId === myUserId);
  const hasSubmitted = Boolean(myEntry);
  const respondentCount = entries.length;
  const displayOptions = options ?? FIBONACCI_OPTIONS;
  const useButtons = Boolean(options) || displayOptions === FIBONACCI_OPTIONS || displayOptions === TSHIRT_OPTIONS;

  const stats = revealed && showAverage ? computeStats(entries.filter((e) => e.value !== "?")) : null;
  const distribution = revealed ? computeDistribution(entries, displayOptions) : null;
  const maxCount = distribution ? Math.max(...Object.values(distribution), 1) : 1;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 flex flex-col px-4 py-6 gap-5"
      data-testid="eg-root"
    >
      <div className="text-center">
        <div className="text-3xl mb-1">🃏</div>
        <h1 className="text-2xl font-bold text-gray-800" data-testid="eg-title">{title}</h1>
        <p className="text-gray-600 mt-2 text-base font-medium" data-testid="eg-question">{question}</p>
        {unit && (
          <span className="inline-block mt-1 text-xs text-indigo-500 font-medium" data-testid="eg-unit">
            單位：{unit}
          </span>
        )}
      </div>

      {!hasSubmitted ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 justify-center" data-testid="eg-options">
            {displayOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => onSelectValue(opt)}
                className={`w-14 h-14 rounded-xl text-lg font-bold border-2 transition-all ${
                  localValue === opt
                    ? "bg-indigo-600 text-white border-indigo-600 scale-105 shadow-lg"
                    : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300"
                }`}
                data-testid={`eg-opt-${opt}`}
              >
                {opt}
              </button>
            ))}
          </div>

          <Button
            onClick={onSubmit}
            disabled={!localValue}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="eg-submit-btn"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            提交估算
          </Button>
          {!localValue && (
            <p className="text-center text-xs text-gray-400" data-testid="eg-no-value-hint">
              請選擇估算值後再提交
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow p-5 text-center" data-testid="eg-submitted-card">
          <CheckCircle2 className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
          <p className="font-semibold text-gray-700" data-testid="eg-submitted-msg">
            已提交：<span className="text-indigo-600 text-2xl font-bold">{myEntry?.value}</span>
            {unit && <span className="text-gray-500 ml-1 text-sm">{unit}</span>}
          </p>
          {!revealed && (
            <Button
              onClick={onReveal}
              className="mt-4 bg-amber-500 hover:bg-amber-600 text-white"
              data-testid="eg-reveal-btn"
            >
              <Eye className="w-4 h-4 mr-2" />
              揭曉所有估算
            </Button>
          )}
        </div>
      )}

      <div
        className="bg-white rounded-xl p-3 text-center text-sm text-gray-500"
        data-testid="eg-count"
      >
        已提交 <span className="font-semibold text-indigo-600">{respondentCount}</span> 人
        {!revealed && respondentCount > 0 && (
          <span className="text-xs text-gray-400 ml-2">（揭曉前保密）</span>
        )}
      </div>

      {revealed && respondentCount > 0 && (
        <div className="bg-white rounded-2xl shadow p-5" data-testid="eg-results">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-indigo-500" />
            <p className="font-semibold text-gray-700">估算結果揭曉</p>
          </div>

          {stats && (
            <div
              className="grid grid-cols-3 gap-3 mb-4 bg-indigo-50 rounded-xl p-3"
              data-testid="eg-stats"
            >
              <div className="text-center">
                <p className="text-xs text-gray-500">平均</p>
                <p className="text-xl font-bold text-indigo-600" data-testid="eg-avg">{stats.avg}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">最低</p>
                <p className="text-xl font-bold text-green-600" data-testid="eg-min">{stats.min}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">最高</p>
                <p className="text-xl font-bold text-red-500" data-testid="eg-max">{stats.max}</p>
              </div>
            </div>
          )}

          {distribution && (
            <div className="flex flex-col gap-2 mb-4" data-testid="eg-distribution">
              {displayOptions.map((opt) => {
                const count = distribution[opt] ?? 0;
                const pct = (count / maxCount) * 100;
                return (
                  <div key={opt} className="flex items-center gap-2" data-testid={`eg-dist-${opt}`}>
                    <span className="w-8 text-center text-sm font-bold text-gray-700">{opt}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-sm text-gray-600">{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          {showAllEstimates && (
            <div data-testid="eg-all-entries">
              <p className="text-xs text-gray-500 mb-2">所有估算</p>
              <div className="flex flex-wrap gap-2">
                {entries.map((entry) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border ${
                      entry.userId === myUserId
                        ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                        : "bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                    data-testid={`eg-entry-${entry.userId}`}
                  >
                    <span className="font-bold">{entry.value}</span>
                    {unit && <span className="text-xs opacity-70">{unit}</span>}
                    <span className="text-xs opacity-60 ml-1">{entry.userName}</span>
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
