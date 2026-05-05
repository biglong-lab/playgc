import { CheckCircle2, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AgreementStatement {
  id: string;
  text: string;
}

export interface AgreementMatrixConfig {
  title: string;
  instructions?: string;
  statements: AgreementStatement[];
  showResults: boolean;
}

export interface MatrixResponse {
  userId: string;
  userName: string;
  ratings: Record<string, number>;
  submittedAt: number;
}

export interface AgreementMatrixState extends Record<string, unknown> {
  responses: MatrixResponse[];
}

const RATING_OPTIONS = [
  { value: 3, label: "同意", emoji: "👍", color: "bg-green-500" },
  { value: 2, label: "普通", emoji: "😐", color: "bg-yellow-400" },
  { value: 1, label: "不同意", emoji: "👎", color: "bg-red-400" },
];

interface Props {
  config: AgreementMatrixConfig;
  state: AgreementMatrixState;
  myUserId: string;
  localRatings: Record<string, number>;
  onRate: (statementId: string, value: number) => void;
  onSubmit: () => void;
}

function distributionFor(
  responses: MatrixResponse[],
  statementId: string,
): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const r of responses) {
    const v = r.ratings[statementId];
    if (v !== undefined) dist[v] = (dist[v] ?? 0) + 1;
  }
  return dist;
}

export default function AgreementMatrix({
  config,
  state,
  myUserId,
  localRatings,
  onRate,
  onSubmit,
}: Props) {
  const { title, instructions, statements, showResults } = config;
  const { responses } = state;

  const myResponse = responses.find((r) => r.userId === myUserId);
  const hasSubmitted = Boolean(myResponse);
  const allRated = statements.every((s) => localRatings[s.id] !== undefined);
  const respondentCount = responses.length;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex flex-col px-4 py-6 gap-5"
      data-testid="am-root"
    >
      <div className="text-center">
        <div className="text-3xl mb-1">📊</div>
        <h1 className="text-2xl font-bold text-gray-800" data-testid="am-title">{title}</h1>
        {instructions && (
          <p className="text-gray-500 text-sm mt-1" data-testid="am-instructions">{instructions}</p>
        )}
      </div>

      <div className="flex justify-center gap-4 text-xs text-gray-500">
        {RATING_OPTIONS.map((opt) => (
          <span key={opt.value} className="flex items-center gap-1">
            <span>{opt.emoji}</span>
            <span>{opt.label}</span>
          </span>
        ))}
      </div>

      {!hasSubmitted ? (
        <div className="flex flex-col gap-3">
          {statements.map((stmt, idx) => {
            const selected = localRatings[stmt.id];
            return (
              <div
                key={stmt.id}
                className="bg-white rounded-xl shadow-sm p-4"
                data-testid={`am-stmt-${stmt.id}`}
              >
                <p className="text-sm font-medium text-gray-700 mb-3" data-testid={`am-stmt-text-${stmt.id}`}>
                  <span className="text-gray-400 mr-1">{idx + 1}.</span>
                  {stmt.text}
                </p>
                <div className="flex gap-2">
                  {RATING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onRate(stmt.id, opt.value)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        selected === opt.value
                          ? "text-white border-transparent"
                          : "bg-white border-gray-200 text-gray-500 hover:border-teal-300"
                      }`}
                      style={
                        selected === opt.value
                          ? {
                              backgroundColor:
                                opt.value === 3 ? "#22C55E" : opt.value === 2 ? "#FACC15" : "#F87171",
                              borderColor:
                                opt.value === 3 ? "#22C55E" : opt.value === 2 ? "#FACC15" : "#F87171",
                            }
                          : {}
                      }
                      data-testid={`am-rate-${stmt.id}-${opt.value}`}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <Button
            onClick={onSubmit}
            disabled={!allRated}
            className="bg-teal-600 hover:bg-teal-700 text-white"
            data-testid="am-submit-btn"
          >
            <LayoutList className="w-4 h-4 mr-2" />
            提交評分
          </Button>
          {!allRated && (
            <p className="text-center text-xs text-gray-400" data-testid="am-incomplete-hint">
              請為所有陳述句評分後再提交
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow p-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="font-medium text-gray-700" data-testid="am-submitted-msg">已提交評分</p>
        </div>
      )}

      <div
        className="bg-white rounded-xl p-3 text-center text-sm text-gray-500"
        data-testid="am-count"
      >
        已回應 <span className="font-semibold text-teal-600">{respondentCount}</span> 人
      </div>

      {showResults && respondentCount > 0 && (
        <div className="bg-white rounded-2xl shadow p-5" data-testid="am-results">
          <p className="font-semibold text-gray-700 mb-4">群體評分結果</p>
          {statements.map((stmt) => {
            const dist = distributionFor(responses, stmt.id);
            const total = respondentCount;
            return (
              <div key={stmt.id} className="mb-5" data-testid={`am-result-${stmt.id}`}>
                <p className="text-sm text-gray-600 mb-2" data-testid={`am-result-text-${stmt.id}`}>
                  {stmt.text}
                </p>
                <div className="flex h-4 rounded-full overflow-hidden gap-px">
                  {RATING_OPTIONS.map((opt) => {
                    const count = dist[opt.value] ?? 0;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div
                        key={opt.value}
                        className={`${opt.color} transition-all`}
                        style={{ width: `${pct}%`, minWidth: count > 0 ? 4 : 0 }}
                        title={`${opt.label}: ${count}`}
                        data-testid={`am-bar-${stmt.id}-${opt.value}`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  {RATING_OPTIONS.map((opt) => {
                    const count = dist[opt.value] ?? 0;
                    return (
                      <span key={opt.value} data-testid={`am-count-${stmt.id}-${opt.value}`}>
                        {opt.emoji} {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
