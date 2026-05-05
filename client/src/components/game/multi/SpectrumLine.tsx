import { CheckCircle2, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SpectrumQuestion {
  id: string;
  leftLabel: string;
  rightLabel: string;
  leftEmoji?: string;
  rightEmoji?: string;
}

export interface SpectrumLineConfig {
  title: string;
  instructions?: string;
  questions: SpectrumQuestion[];
  showResults: boolean;
  showNames: boolean;
}

export interface SpectrumPlacement {
  userId: string;
  userName: string;
  positions: Record<string, number>;
  submittedAt: number;
}

export interface SpectrumLineState extends Record<string, unknown> {
  placements: SpectrumPlacement[];
}

interface Props {
  config: SpectrumLineConfig;
  state: SpectrumLineState;
  myUserId: string;
  localPositions: Record<string, number>;
  onPositionChange: (questionId: string, position: number) => void;
  onSubmit: () => void;
}

function average(nums: number[]): number {
  if (nums.length === 0) return 50;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export default function SpectrumLine({
  config,
  state,
  myUserId,
  localPositions,
  onPositionChange,
  onSubmit,
}: Props) {
  const { title, instructions, questions, showResults, showNames } = config;
  const { placements } = state;

  const myPlacement = placements.find((p) => p.userId === myUserId);
  const hasSubmitted = Boolean(myPlacement);
  const allAnswered = questions.every((q) => localPositions[q.id] !== undefined);
  const respondentCount = placements.length;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex flex-col px-4 py-6 gap-5"
      data-testid="sl-root"
    >
      <div className="text-center">
        <div className="text-3xl mb-1">🎯</div>
        <h1 className="text-2xl font-bold text-gray-800" data-testid="sl-title">{title}</h1>
        {instructions && (
          <p className="text-gray-500 text-sm mt-1" data-testid="sl-instructions">{instructions}</p>
        )}
      </div>

      {!hasSubmitted ? (
        <div className="flex flex-col gap-4">
          {questions.map((q) => {
            const pos = localPositions[q.id] ?? 50;
            return (
              <div
                key={q.id}
                className="bg-white rounded-xl shadow-sm p-4"
                data-testid={`sl-question-${q.id}`}
              >
                <div className="flex justify-between items-center mb-3 text-sm">
                  <span className="flex items-center gap-1 text-gray-600 font-medium">
                    {q.leftEmoji && <span>{q.leftEmoji}</span>}
                    <span data-testid={`sl-left-${q.id}`}>{q.leftLabel}</span>
                  </span>
                  <span className="flex items-center gap-1 text-gray-600 font-medium">
                    <span data-testid={`sl-right-${q.id}`}>{q.rightLabel}</span>
                    {q.rightEmoji && <span>{q.rightEmoji}</span>}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pos}
                  onChange={(e) => onPositionChange(q.id, Number(e.target.value))}
                  className="w-full accent-sky-500"
                  data-testid={`sl-slider-${q.id}`}
                />
                <div className="flex justify-center mt-1">
                  <span className="text-xs text-sky-600 font-semibold" data-testid={`sl-value-${q.id}`}>
                    {pos < 20 ? `偏${q.leftLabel}` : pos > 80 ? `偏${q.rightLabel}` : "中間型"}
                  </span>
                </div>
              </div>
            );
          })}

          <Button
            onClick={onSubmit}
            disabled={!allAnswered}
            className="bg-sky-600 hover:bg-sky-700 text-white"
            data-testid="sl-submit-btn"
          >
            <Sliders className="w-4 h-4 mr-2" />
            提交定位
          </Button>
          {!allAnswered && (
            <p className="text-center text-xs text-gray-400" data-testid="sl-incomplete-hint">
              請為所有光譜選擇後再提交
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow p-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-sky-500 mx-auto mb-2" />
          <p className="font-medium text-gray-700" data-testid="sl-submitted-msg">已提交光譜定位</p>
        </div>
      )}

      <div
        className="bg-white rounded-xl p-3 text-center text-sm text-gray-500"
        data-testid="sl-count"
      >
        已回應 <span className="font-semibold text-sky-600">{respondentCount}</span> 人
      </div>

      {showResults && respondentCount > 0 && (
        <div className="bg-white rounded-2xl shadow p-5" data-testid="sl-results">
          <p className="font-semibold text-gray-700 mb-4">群體光譜分布</p>
          {questions.map((q) => {
            const positions = placements
              .map((p) => p.positions[q.id])
              .filter((v) => v !== undefined) as number[];
            const avg = average(positions);
            return (
              <div key={q.id} className="mb-5" data-testid={`sl-result-${q.id}`}>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{q.leftEmoji} {q.leftLabel}</span>
                  <span>{q.rightLabel} {q.rightEmoji}</span>
                </div>
                <div className="relative h-6 bg-gray-100 rounded-full">
                  {positions.map((pos, idx) => {
                    const placement = placements[idx];
                    return (
                      <div
                        key={placement?.userId ?? idx}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-sky-400 rounded-full opacity-70"
                        style={{ left: `${pos}%` }}
                        title={showNames ? placement?.userName : undefined}
                        data-testid={`sl-dot-${q.id}-${placement?.userId}`}
                      />
                    );
                  })}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-sky-600 rounded-full border-2 border-white shadow"
                    style={{ left: `${avg}%` }}
                    data-testid={`sl-avg-${q.id}`}
                    title={`平均 ${avg.toFixed(0)}%`}
                  />
                </div>
                <p className="text-xs text-center text-gray-400 mt-1" data-testid={`sl-avg-label-${q.id}`}>
                  群體平均偏{avg <= 50 ? q.leftLabel : q.rightLabel}（{avg.toFixed(0)}%）
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
