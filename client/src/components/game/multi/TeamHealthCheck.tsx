import { CheckCircle2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HealthDimension {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
}

export interface TeamHealthConfig {
  title: string;
  dimensions: HealthDimension[];
  scaleMin: number;
  scaleMax: number;
  anonymous: boolean;
  showResults: boolean;
}

export interface TeamHealthResponse {
  userId: string;
  userName: string;
  scores: Record<string, number>;
  submittedAt: number;
}

export interface TeamHealthState extends Record<string, unknown> {
  responses: TeamHealthResponse[];
}

function scoreColor(avg: number, max: number): string {
  const ratio = avg / max;
  if (ratio >= 0.75) return "bg-green-500";
  if (ratio >= 0.5) return "bg-yellow-400";
  return "bg-red-400";
}

function scoreLabel(avg: number, max: number): string {
  const ratio = avg / max;
  if (ratio >= 0.75) return "良好";
  if (ratio >= 0.5) return "普通";
  return "需改善";
}

interface Props {
  config: TeamHealthConfig;
  state: TeamHealthState;
  myUserId: string;
  localScores: Record<string, number>;
  onScoreChange: (dimensionId: string, score: number) => void;
  onSubmit: () => void;
}

export default function TeamHealthCheck({
  config,
  state,
  myUserId,
  localScores,
  onScoreChange,
  onSubmit,
}: Props) {
  const { title, dimensions, scaleMin, scaleMax, anonymous, showResults } = config;
  const { responses } = state;

  const myResponse = responses.find((r) => r.userId === myUserId);
  const hasSubmitted = Boolean(myResponse);
  const respondentCount = responses.length;
  const canSubmit = dimensions.every((d) => localScores[d.id] !== undefined);

  const avgScores: Record<string, number> = {};
  if (respondentCount > 0) {
    for (const dim of dimensions) {
      const total = responses.reduce((sum, r) => sum + (r.scores[dim.id] ?? 0), 0);
      avgScores[dim.id] = Math.round((total / respondentCount) * 10) / 10;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex flex-col px-4 py-6 gap-5" data-testid="team-health-root">
      <div className="text-center">
        <div className="text-3xl mb-1">💪</div>
        <h1 className="text-2xl font-bold text-gray-800" data-testid="thc-title">{title}</h1>
        <p className="text-sm text-gray-400 mt-1">
          以 {scaleMin}（非常不同意）到 {scaleMax}（完全同意）為團隊打分
          {anonymous && "（匿名）"}
        </p>
      </div>

      {!hasSubmitted ? (
        <div className="flex flex-col gap-4">
          {dimensions.map((dim) => {
            const currentScore = localScores[dim.id] ?? 0;
            return (
              <div
                key={dim.id}
                className="bg-white rounded-xl shadow-sm p-4"
                data-testid={`thc-dim-${dim.id}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  {dim.emoji && <span className="text-xl">{dim.emoji}</span>}
                  <span className="font-medium text-gray-700" data-testid={`thc-dim-label-${dim.id}`}>
                    {dim.label}
                  </span>
                  {dim.description && (
                    <span className="text-xs text-gray-400 ml-auto">{dim.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 justify-between">
                  <span className="text-xs text-gray-400 w-14">不同意</span>
                  {Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => i + scaleMin).map((val) => (
                    <button
                      key={val}
                      onClick={() => onScoreChange(dim.id, val)}
                      className={`w-10 h-10 rounded-full text-sm font-semibold transition-all border-2 ${
                        currentScore === val
                          ? "bg-teal-500 border-teal-500 text-white scale-110"
                          : "border-gray-200 text-gray-400 hover:border-teal-300"
                      }`}
                      data-testid={`thc-score-${dim.id}-${val}`}
                    >
                      {val}
                    </button>
                  ))}
                  <span className="text-xs text-gray-400 w-14 text-right">同意</span>
                </div>
              </div>
            );
          })}

          <Button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="bg-teal-600 hover:bg-teal-700 text-white"
            data-testid="thc-submit-btn"
          >
            <Heart className="w-4 h-4 mr-2" />
            提交評估
          </Button>
          {!canSubmit && (
            <p className="text-center text-xs text-gray-400" data-testid="thc-incomplete-hint">
              請為所有維度評分後再提交
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow p-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="font-medium text-gray-700" data-testid="thc-submitted-msg">已完成評估</p>
          <p className="text-sm text-gray-400 mt-1">感謝你的真實回饋</p>
        </div>
      )}

      <div className="bg-white rounded-xl p-3 text-center text-sm text-gray-500" data-testid="thc-count">
        已回應 <span className="font-semibold text-teal-600">{respondentCount}</span> 人
      </div>

      {showResults && respondentCount > 0 && (
        <div className="bg-white rounded-2xl shadow p-5" data-testid="thc-results">
          <p className="font-semibold text-gray-700 mb-4">團隊健康報告</p>
          {dimensions.map((dim) => {
            const avg = avgScores[dim.id] ?? 0;
            const pct = Math.round(((avg - scaleMin) / (scaleMax - scaleMin)) * 100);
            const color = scoreColor(avg, scaleMax);
            const label = scoreLabel(avg, scaleMax);
            return (
              <div key={dim.id} className="mb-4" data-testid={`thc-result-${dim.id}`}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">
                    {dim.emoji} {dim.label}
                  </span>
                  <span className="font-semibold" data-testid={`thc-avg-${dim.id}`}>
                    {avg} / {scaleMax}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full text-white ${color}`}>
                      {label}
                    </span>
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${color}`}
                    style={{ width: `${pct}%` }}
                    data-testid={`thc-bar-${dim.id}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
