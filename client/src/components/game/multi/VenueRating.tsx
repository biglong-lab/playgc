import { useState } from "react";
import { Loader2, Star, BarChart2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface DimensionScores extends Record<string, unknown> {
  ambience: number;
  service: number;
  character: number;
  overall: number;
}

interface VenueRatingEntry extends Record<string, unknown> {
  userId: string;
  userName: string;
  scores: DimensionScores;
}

interface VenueRatingState extends Record<string, unknown> {
  ratings: VenueRatingEntry[];
  revealed: boolean;
}

interface VenueRatingConfig {
  title?: string;
  venueName?: string;
}

function extractConfig(raw: Record<string, unknown>): VenueRatingConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    venueName: typeof raw.venueName === "string" ? raw.venueName : undefined,
  };
}

const DIMENSIONS = [
  { key: "ambience" as const, label: "氛圍", icon: "✨" },
  { key: "service" as const, label: "服務", icon: "🤝" },
  { key: "character" as const, label: "特色", icon: "🎯" },
  { key: "overall" as const, label: "整體", icon: "⭐" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function VenueRating({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<VenueRatingState>({
    gameId,
    sessionId,
    pageId,
    type: "venue_rating",
    defaultState: { ratings: [], revealed: false },
  });

  const [scores, setScores] = useState<DimensionScores>({
    ambience: 0,
    service: 0,
    character: 0,
    overall: 0,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="vrt-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const ratings = state.ratings as VenueRatingEntry[];
  const revealed = state.revealed as boolean;
  const myRating = ratings.find((r) => r.userId === userId);
  const canSubmit = Object.values(scores).every((s) => (s as number) > 0);

  const handleSetScore = (dim: keyof DimensionScores, score: number) => {
    setScores((prev) => ({ ...prev, [dim]: score }));
  };

  const handleSubmit = () => {
    if (!canSubmit || myRating) return;
    updateState({ ...state, ratings: [...ratings, { userId, userName, scores }] });
  };

  const avgScore = (dim: keyof DimensionScores) => {
    if (ratings.length === 0) return 0;
    return ratings.reduce((s, r) => s + (r.scores[dim] as number), 0) / ratings.length;
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="vrt-title" className="text-xl font-bold text-center">
        {cfg.title ?? "場域評分"}
      </div>
      {cfg.venueName && (
        <div data-testid="vrt-venue-name" className="text-sm text-center font-medium text-primary">
          {cfg.venueName}
        </div>
      )}
      <div data-testid="vrt-count" className="text-xs text-center text-muted-foreground">
        已有 {ratings.length} 人評分
      </div>

      {!myRating && (
        <div data-testid="vrt-form" className="flex flex-col gap-4 bg-card rounded-xl p-4 border">
          {DIMENSIONS.map((dim) => (
            <div key={dim.key} data-testid={`vrt-dim-${dim.key}`}>
              <div className="flex items-center gap-1 mb-2">
                <span>{dim.icon}</span>
                <span className="text-sm font-medium">{dim.label}</span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    data-testid={`vrt-star-${dim.key}-${s}`}
                    onClick={() => handleSetScore(dim.key, s)}
                    className={`w-10 h-10 rounded-lg transition-colors ${
                      scores[dim.key] >= s
                        ? "bg-amber-400 text-white"
                        : "bg-muted text-muted-foreground hover:bg-amber-100"
                    }`}
                  >
                    <Star className="w-4 h-4 mx-auto" fill={scores[dim.key] >= s ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            data-testid="vrt-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Star className="w-4 h-4" />
            提交評分
          </button>
        </div>
      )}

      {myRating && (
        <div data-testid="vrt-my-rating" className="bg-amber-50 rounded-xl p-3 border border-amber-200">
          <div className="text-sm font-semibold text-amber-700 mb-2">你的評分已提交</div>
          <div className="grid grid-cols-4 gap-2">
            {DIMENSIONS.map((dim) => (
              <div key={dim.key} className="text-center">
                <div className="text-xs text-muted-foreground">{dim.label}</div>
                <div className="font-bold text-amber-600">{myRating.scores[dim.key]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="vrt-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <BarChart2 className="w-4 h-4" />
          揭曉全隊評分
        </button>
      )}

      {revealed && ratings.length === 0 && (
        <div data-testid="vrt-empty" className="text-center text-muted-foreground p-8">
          還沒有人評分
        </div>
      )}

      {revealed && ratings.length > 0 && (
        <div data-testid="vrt-result" className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-center text-amber-700">
            全隊評分結果（{ratings.length} 人）
          </div>
          {DIMENSIONS.map((dim) => {
            const avg = avgScore(dim.key);
            return (
              <div key={dim.key} data-testid={`vrt-avg-${dim.key}`} className="flex items-center gap-3">
                <div className="w-16 text-xs text-right">
                  {dim.icon} {dim.label}
                </div>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${(avg / 5) * 100}%` }}
                  />
                </div>
                <div className="w-8 text-xs font-bold text-amber-600">{avg.toFixed(1)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
