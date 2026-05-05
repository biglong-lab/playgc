import { useState } from "react";
import { Loader2, Eye } from "lucide-react";

export interface NumberPlacement extends Record<string, unknown> {
  placementId: string;
  userId: string;
  userName: string;
  value: number;
}

export interface NumberLineConfig extends Record<string, unknown> {
  title: string;
  question: string;
  min: number;
  max: number;
  unit: string;
  lowLabel: string;
  highLabel: string;
}

export interface NumberLineState extends Record<string, unknown> {
  placements: NumberPlacement[];
  revealed: boolean;
}

interface NumberLineProps {
  config: NumberLineConfig;
  state: NumberLineState;
  userId: string;
  isTeamLead?: boolean;
  isLoaded: boolean;
  onSubmit: (value: number) => void;
  onReveal: () => void;
}

export function NumberLine({
  config,
  state,
  userId,
  isTeamLead,
  isLoaded,
  onSubmit,
  onReveal,
}: NumberLineProps) {
  const { min, max } = config;
  const [value, setValue] = useState(Math.round((min + max) / 2));

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  const { title, question, unit, lowLabel, highLabel } = config;
  const { placements, revealed } = state;
  const myPlacement = placements.find((p) => p.userId === userId);
  const hasSubmitted = !!myPlacement;

  const avg =
    placements.length > 0
      ? Math.round(placements.reduce((s, p) => s + p.value, 0) / placements.length)
      : 0;

  const buckets: Record<number, number> = {};
  for (let v = min; v <= max; v++) buckets[v] = 0;
  for (const p of placements) {
    if (buckets[p.value] !== undefined) buckets[p.value]++;
  }
  const maxCount = Math.max(...Object.values(buckets), 1);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="nl-title" className="text-xl font-bold text-center text-indigo-700">
        {title}
      </h2>
      <div
        data-testid="nl-question"
        className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center text-base font-medium text-indigo-800"
      >
        {question}
      </div>
      <p data-testid="nl-count" className="text-sm text-gray-500 text-center">
        已有 {placements.length} 人回答
      </p>

      {!hasSubmitted && !revealed && (
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{lowLabel}</span>
            <span className="font-bold text-indigo-600 text-base">
              {value} {unit}
            </span>
            <span>{highLabel}</span>
          </div>
          <input
            type="range"
            data-testid="nl-slider"
            min={min}
            max={max}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{min}</span>
            <span>{max}</span>
          </div>
          <button
            data-testid="nl-submit-btn"
            onClick={() => onSubmit(value)}
            className="w-full bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium"
          >
            標記我的位置
          </button>
        </div>
      )}

      {hasSubmitted && !revealed && (
        <div
          data-testid="nl-my-placement"
          className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center text-indigo-700 text-sm"
        >
          你標記了：
          <strong className="text-xl ml-2">{myPlacement?.value}</strong>
          <span className="ml-1">{unit}</span>
        </div>
      )}

      {isTeamLead && !revealed && placements.length > 0 && (
        <button
          data-testid="nl-reveal-btn"
          onClick={onReveal}
          className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-white py-2 rounded-xl text-sm font-medium"
        >
          <Eye size={16} />
          公開分佈
        </button>
      )}

      {revealed && (
        <div data-testid="nl-result" className="space-y-3">
          <p className="text-center text-sm font-semibold text-gray-600">
            全隊分佈（平均：{avg} {unit}）
          </p>
          <div data-testid="nl-avg" className="text-center text-2xl font-bold text-indigo-600">
            {avg} <span className="text-base font-normal text-gray-500">{unit}</span>
          </div>
          <div className="flex items-end gap-0.5 h-20">
            {Object.entries(buckets).map(([v, count]) => (
              <div
                key={v}
                data-testid={`nl-bar-${v}`}
                title={`${v}: ${count} 人`}
                className="flex-1 bg-indigo-400 rounded-t transition-all"
                style={{
                  height: `${(count / maxCount) * 100}%`,
                  minHeight: count > 0 ? "4px" : "0",
                  opacity: count > 0 ? 1 : 0.15,
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>{min} {lowLabel}</span>
            <span>{max} {highLabel}</span>
          </div>
          {placements.map((p) => (
            <div
              key={p.placementId}
              data-testid={`nl-placement-${p.placementId}`}
              className="flex items-center gap-2 text-xs text-gray-600"
            >
              <span className="font-medium">{p.userName}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="bg-indigo-400 h-2 rounded-full"
                  style={{ width: `${((p.value - min) / (max - min)) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right">{p.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NumberLine;
