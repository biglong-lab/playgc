import { useMemo } from "react";
import { Button } from "@/components/ui/button";

export interface ConsensusScaleConfig {
  title: string;
  question: string;
  scaleMin: number;
  scaleMax: number;
  minLabel?: string;
  maxLabel?: string;
  showAverage: boolean;
  showDistribution: boolean;
}

export interface ScaleResponse {
  userId: string;
  userName: string;
  value: number;
  respondedAt: number;
}

export interface ConsensusScaleState extends Record<string, unknown> {
  responses: ScaleResponse[];
}

interface Props {
  config: ConsensusScaleConfig;
  state: ConsensusScaleState;
  myUserId: string;
  onSelect: (value: number) => void;
}

const SCALE_COLORS = [
  "bg-red-400",
  "bg-orange-400",
  "bg-yellow-400",
  "bg-lime-400",
  "bg-green-400",
  "bg-emerald-500",
  "bg-teal-500",
];

export default function ConsensusScale({ config, state, myUserId, onSelect }: Props) {
  const {
    title,
    question,
    scaleMin,
    scaleMax,
    minLabel,
    maxLabel,
    showAverage,
    showDistribution,
  } = config;

  const { responses } = state;
  const myResponse = responses.find((r) => r.userId === myUserId);
  const myValue = myResponse?.value;

  const scaleValues = useMemo(() => {
    const vals: number[] = [];
    for (let i = scaleMin; i <= scaleMax; i++) vals.push(i);
    return vals;
  }, [scaleMin, scaleMax]);

  const average = useMemo(() => {
    if (responses.length === 0) return null;
    const sum = responses.reduce((acc, r) => acc + r.value, 0);
    return (sum / responses.length).toFixed(1);
  }, [responses]);

  const distribution = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const v of scaleValues) counts[v] = 0;
    for (const r of responses) counts[r.value] = (counts[r.value] ?? 0) + 1;
    return counts;
  }, [responses, scaleValues]);

  const maxCount = useMemo(
    () => Math.max(...Object.values(distribution), 1),
    [distribution],
  );

  const getColor = (v: number) => {
    const idx = Math.floor(((v - scaleMin) / (scaleMax - scaleMin)) * (SCALE_COLORS.length - 1));
    return SCALE_COLORS[Math.min(idx, SCALE_COLORS.length - 1)];
  };

  return (
    <div
      className="min-h-screen bg-white flex flex-col items-center px-4 py-8 gap-6"
      data-testid="consensus-scale-root"
    >
      {/* Header */}
      <div className="text-center max-w-lg">
        <h1 className="text-xl font-bold text-gray-700" data-testid="scale-title">{title}</h1>
        <p className="text-2xl font-semibold text-gray-900 mt-3" data-testid="scale-question">
          {question}
        </p>
      </div>

      {/* Participant count */}
      <p className="text-sm text-gray-400" data-testid="response-count">
        {responses.length} 人已作答
      </p>

      {/* Scale buttons */}
      <div className="flex flex-col items-center gap-3 w-full max-w-sm">
        {/* Labels */}
        <div className="flex justify-between w-full text-xs text-gray-400">
          <span data-testid="min-label">{minLabel ?? scaleMin}</span>
          <span data-testid="max-label">{maxLabel ?? scaleMax}</span>
        </div>

        {/* Buttons row */}
        <div className="flex gap-2 w-full justify-center" data-testid="scale-buttons">
          {scaleValues.map((v) => {
            const colorClass = getColor(v);
            const isSelected = myValue === v;
            return (
              <button
                key={v}
                onClick={() => onSelect(v)}
                className={`w-10 h-10 rounded-full font-bold text-sm transition-all
                  ${isSelected
                    ? `${colorClass} text-white ring-4 ring-offset-2 ring-current scale-110 shadow-lg`
                    : `border-2 border-gray-200 text-gray-500 hover:${colorClass} hover:text-white`
                  }`}
                data-testid={`scale-btn-${v}`}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>

      {/* My selection */}
      {myValue !== undefined && (
        <div className="text-sm font-medium text-gray-600" data-testid="my-selection">
          你的選擇：<span className={`font-bold text-lg ${getColor(myValue).replace("bg-", "text-")}`}>{myValue}</span>
          <span className="text-gray-400 ml-2">（可重新選擇）</span>
        </div>
      )}

      {!myValue && (
        <p className="text-gray-400 text-sm" data-testid="no-selection-msg">請選擇你的分數</p>
      )}

      {/* Average */}
      {showAverage && average !== null && (
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-800" data-testid="average-value">{average}</div>
          <div className="text-xs text-gray-400">全場平均</div>
        </div>
      )}

      {/* Distribution */}
      {showDistribution && responses.length > 0 && (
        <div className="w-full max-w-sm">
          <p className="text-xs text-gray-400 mb-2 text-center">分佈</p>
          <div className="flex items-end gap-1 h-20" data-testid="distribution-chart">
            {scaleValues.map((v) => {
              const count = distribution[v] ?? 0;
              const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={v} className="flex flex-col items-center flex-1 gap-1">
                  <div className="text-xs text-gray-500" data-testid={`dist-count-${v}`}>{count}</div>
                  <div
                    className={`w-full rounded-t ${getColor(v)} transition-all duration-500`}
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                    data-testid={`dist-bar-${v}`}
                  />
                  <div className="text-xs text-gray-400">{v}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
