import { Loader2, BarChart2, CheckCircle2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface RatingEntry extends Record<string, unknown> {
  userId: string;
  userName: string;
  score: number;
}

interface ScaleCheckState extends Record<string, unknown> {
  ratings: RatingEntry[];
  revealed: boolean;
}

interface ScaleCheckConfig {
  title?: string;
  question?: string;
  minLabel?: string;
  maxLabel?: string;
}

function extractConfig(raw: Record<string, unknown>): ScaleCheckConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    question: typeof raw.question === "string" ? raw.question : undefined,
    minLabel: typeof raw.minLabel === "string" ? raw.minLabel : undefined,
    maxLabel: typeof raw.maxLabel === "string" ? raw.maxLabel : undefined,
  };
}

const SCORE_COLORS: Record<number, string> = {
  1: "bg-red-100 border-red-300 text-red-700",
  2: "bg-orange-100 border-orange-300 text-orange-700",
  3: "bg-yellow-100 border-yellow-300 text-yellow-700",
  4: "bg-lime-100 border-lime-300 text-lime-700",
  5: "bg-green-100 border-green-300 text-green-700",
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ScaleCheck({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ScaleCheckState>({
    gameId,
    sessionId,
    pageId,
    type: "scale_check",
    defaultState: { ratings: [], revealed: false },
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="slc-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const ratings = state.ratings as RatingEntry[];
  const revealed = state.revealed as boolean;
  const myRating = ratings.find((r) => r.userId === userId);

  const handleRate = (score: number) => {
    if (myRating) return;
    updateState({ ...state, ratings: [...ratings, { userId, userName, score }] });
  };

  const avg =
    ratings.length > 0
      ? (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1)
      : null;

  const distribution = [1, 2, 3, 4, 5].map((s) => ({
    score: s,
    count: ratings.filter((r) => r.score === s).length,
  }));

  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="slc-title" className="text-xl font-bold text-center">
        {cfg.title ?? "量表評分"}
      </div>
      <div data-testid="slc-question" className="text-sm text-center font-medium">
        {cfg.question ?? "你對這次活動的滿意程度？"}
      </div>
      <div data-testid="slc-count" className="text-xs text-center text-muted-foreground">
        已有 {ratings.length} 人評分
      </div>

      {!myRating && (
        <div data-testid="slc-scale" className="flex flex-col gap-3">
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            <span data-testid="slc-min-label">{cfg.minLabel ?? "非常不同意"}</span>
            <span data-testid="slc-max-label">{cfg.maxLabel ?? "非常同意"}</span>
          </div>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                data-testid={`slc-score-${score}`}
                onClick={() => handleRate(score)}
                className={`w-14 h-14 rounded-xl border-2 font-bold text-lg transition-colors ${SCORE_COLORS[score]} hover:opacity-80`}
              >
                {score}
              </button>
            ))}
          </div>
        </div>
      )}

      {myRating && (
        <div
          data-testid="slc-my-rating"
          className={`rounded-xl p-3 border ${SCORE_COLORS[myRating.score] ?? ""} flex items-center gap-2`}
        >
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-semibold">你的評分：{myRating.score} 分</span>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="slc-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-slate-700 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <BarChart2 className="w-4 h-4" />
          揭曉全隊評分
        </button>
      )}

      {revealed && ratings.length === 0 && (
        <div data-testid="slc-empty" className="text-center text-muted-foreground p-8">
          還沒有人評分
        </div>
      )}

      {revealed && ratings.length > 0 && (
        <div data-testid="slc-result" className="flex flex-col gap-3">
          <div data-testid="slc-avg" className="text-center">
            <span className="text-3xl font-bold text-slate-700">{avg}</span>
            <span className="text-sm text-muted-foreground ml-1">/ 5</span>
            <div className="text-xs text-muted-foreground mt-0.5">
              共 {ratings.length} 人 · 平均分
            </div>
          </div>
          <div data-testid="slc-distribution" className="flex flex-col gap-1">
            {distribution.map(({ score, count }) => (
              <div key={score} data-testid={`slc-bar-${score}`} className="flex items-center gap-2">
                <span className="text-xs font-bold w-4 text-right">{score}</span>
                <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      score === 5
                        ? "bg-green-400"
                        : score === 4
                          ? "bg-lime-400"
                          : score === 3
                            ? "bg-yellow-400"
                            : score === 2
                              ? "bg-orange-400"
                              : "bg-red-400"
                    }`}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-4">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
