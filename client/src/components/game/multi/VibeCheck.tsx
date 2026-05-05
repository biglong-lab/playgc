import { useState } from "react";
import { Loader2, Eye } from "lucide-react";

export interface VibeDimension extends Record<string, unknown> {
  id: string;
  label: string;
  lowEmoji: string;
  highEmoji: string;
}

export interface VibeEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  scores: Record<string, number>;
}

export interface VibeCheckConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  dimensions: VibeDimension[];
}

export interface VibeCheckState extends Record<string, unknown> {
  entries: VibeEntry[];
  revealed: boolean;
}

interface VibeCheckProps {
  config: VibeCheckConfig;
  state: VibeCheckState;
  userId: string;
  isTeamLead?: boolean;
  isLoaded: boolean;
  onSubmit: (scores: Record<string, number>) => void;
  onReveal: () => void;
}

export function VibeCheck({
  config,
  state,
  userId,
  isTeamLead,
  isLoaded,
  onSubmit,
  onReveal,
}: VibeCheckProps) {
  const { dimensions } = config;
  const initialScores = Object.fromEntries(dimensions.map((d) => [d.id, 50]));
  const [scores, setScores] = useState<Record<string, number>>(initialScores);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-fuchsia-500" size={32} />
      </div>
    );
  }

  const { title, prompt } = config;
  const { entries, revealed } = state;
  const myEntry = entries.find((e) => e.userId === userId);
  const hasSubmitted = !!myEntry;

  function avg(dimId: string): number {
    if (entries.length === 0) return 0;
    const sum = entries.reduce((s, e) => s + ((e.scores[dimId] as number) ?? 0), 0);
    return Math.round(sum / entries.length);
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="vc-title" className="text-xl font-bold text-center text-fuchsia-700">
        {title}
      </h2>
      <p data-testid="vc-prompt" className="text-center text-gray-600 text-sm">
        {prompt}
      </p>
      <p data-testid="vc-count" className="text-sm text-gray-500 text-center">
        已有 {entries.length} 人回應
      </p>

      {!hasSubmitted && !revealed && (
        <div className="space-y-4">
          {dimensions.map((dim) => (
            <div key={dim.id} data-testid={`vc-dim-${dim.id}`} className="space-y-1">
              <div className="flex justify-between items-center text-xs text-gray-600">
                <span>{dim.lowEmoji} {dim.label} 低</span>
                <span className="font-semibold text-fuchsia-600">{scores[dim.id]}</span>
                <span>{dim.label} 高 {dim.highEmoji}</span>
              </div>
              <input
                type="range"
                data-testid={`vc-slider-${dim.id}`}
                min={0}
                max={100}
                value={scores[dim.id]}
                onChange={(e) =>
                  setScores((prev) => ({ ...prev, [dim.id]: Number(e.target.value) }))
                }
                className="w-full accent-fuchsia-500"
              />
            </div>
          ))}
          <button
            data-testid="vc-submit-btn"
            onClick={() => onSubmit(scores)}
            className="w-full bg-fuchsia-600 text-white py-2 rounded-xl text-sm font-medium"
          >
            送出氛圍感測
          </button>
        </div>
      )}

      {hasSubmitted && !revealed && (
        <div
          data-testid="vc-my-entry"
          className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-3 space-y-1"
        >
          {dimensions.map((dim) => (
            <div key={dim.id} className="flex items-center gap-2 text-xs">
              <span className="w-16 text-fuchsia-700">{dim.label}</span>
              <div className="flex-1 bg-fuchsia-100 rounded-full h-2">
                <div
                  className="bg-fuchsia-500 h-2 rounded-full"
                  style={{ width: `${myEntry?.scores[dim.id] ?? 0}%` }}
                />
              </div>
              <span className="text-gray-600 w-6 text-right">
                {myEntry?.scores[dim.id] ?? 0}
              </span>
            </div>
          ))}
        </div>
      )}

      {isTeamLead && !revealed && entries.length > 0 && (
        <button
          data-testid="vc-reveal-btn"
          onClick={onReveal}
          className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-white py-2 rounded-xl text-sm font-medium"
        >
          <Eye size={16} />
          公開氛圍感測
        </button>
      )}

      {revealed && (
        <div data-testid="vc-result" className="space-y-3">
          <p className="text-center text-sm font-semibold text-gray-600">全隊氛圍指數</p>
          {entries.length === 0 && (
            <p data-testid="vc-empty" className="text-center text-gray-400 text-sm">
              還沒有人回應
            </p>
          )}
          {dimensions.map((dim) => {
            const average = avg(dim.id);
            return (
              <div
                key={dim.id}
                data-testid={`vc-avg-${dim.id}`}
                className="space-y-1"
              >
                <div className="flex justify-between text-xs text-gray-600">
                  <span>
                    {dim.lowEmoji} {dim.label} {dim.highEmoji}
                  </span>
                  <span className="font-bold text-fuchsia-600">{average}</span>
                </div>
                <div className="bg-gray-100 rounded-full h-3">
                  <div
                    className="bg-fuchsia-500 h-3 rounded-full transition-all"
                    style={{ width: `${average}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-center text-xs text-gray-400">
            基於 {entries.length} 人的回應
          </p>
        </div>
      )}
    </div>
  );
}

export default VibeCheck;
