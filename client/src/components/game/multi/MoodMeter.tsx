// 🌡️ MoodMeter — 活力確認元件（純 UI）
// 玩家點選 1-5 的情緒/活力，即時看到全隊分佈
// 適用：Workshop 開場暖身、中場能量確認、活動前後對比

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface MoodMeterConfig {
  title?: string;
  question?: string;
  emoji?: string[];
  labels?: string[];
  allowChange?: boolean;
}

export interface MoodMeterState {
  votes: Record<string, number>; // userId → 1-5
}

interface MoodMeterProps {
  config: MoodMeterConfig;
  state: MoodMeterState;
  myUserId: string;
  onVote: (rating: number) => Promise<void>;
}

const DEFAULT_EMOJI = ["😩", "😕", "😐", "😊", "🔥"];
const DEFAULT_LABELS = ["很低", "偏低", "普通", "活躍", "超燃"];

function buildDistribution(votes: Record<string, number>): number[] {
  const dist = [0, 0, 0, 0, 0];
  for (const v of Object.values(votes)) {
    if (v >= 1 && v <= 5) dist[v - 1]++;
  }
  return dist;
}

export default function MoodMeter({ config, state, myUserId, onVote }: MoodMeterProps) {
  const emojis = config.emoji ?? DEFAULT_EMOJI;
  const labels = config.labels ?? DEFAULT_LABELS;
  const allowChange = config.allowChange !== false;

  const myVote = state.votes[myUserId];
  const totalVotes = Object.keys(state.votes).length;
  const dist = buildDistribution(state.votes);

  const average = totalVotes > 0
    ? (Object.values(state.votes).reduce((s, v) => s + v, 0) / totalVotes).toFixed(1)
    : null;

  const maxCount = Math.max(...dist, 1);

  const handleVote = (rating: number) => {
    if (myVote === rating && !allowChange) return;
    void onVote(rating);
  };

  return (
    <div className="space-y-4" data-testid="mood-meter-root">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg" data-testid="mood-meter-title">
              {config.title ?? "🌡️ 活力確認"}
            </CardTitle>
            {average && (
              <Badge variant="outline" data-testid="mood-meter-average">
                平均 {average}
              </Badge>
            )}
          </div>
          {config.question && (
            <p className="text-sm text-muted-foreground">{config.question}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 投票選項 */}
          <div className="grid grid-cols-5 gap-2" data-testid="mood-meter-options">
            {emojis.map((emoji, idx) => {
              const rating = idx + 1;
              const isSelected = myVote === rating;
              return (
                <button
                  key={rating}
                  data-testid={`mood-btn-${rating}`}
                  onClick={() => handleVote(rating)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all",
                    "active:scale-95",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md scale-105"
                      : "border-gray-200 bg-white hover:border-primary/40 hover:bg-primary/5",
                  )}
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-xs text-muted-foreground">{labels[idx]}</span>
                </button>
              );
            })}
          </div>

          {myVote && (
            <p className="text-xs text-center text-muted-foreground" data-testid="mood-my-vote">
              你選了 {emojis[myVote - 1]}{allowChange ? "（可重新選擇）" : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 分佈圖 */}
      {totalVotes > 0 && (
        <Card data-testid="mood-distribution">
          <CardContent className="pt-4">
            <div className="flex items-end justify-between gap-2 h-20">
              {dist.map((count, idx) => {
                const height = count > 0 ? Math.max(8, (count / maxCount) * 100) : 4;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">{count > 0 ? count : ""}</span>
                    <div
                      className={cn(
                        "w-full rounded-t-md transition-all duration-500",
                        myVote === idx + 1 ? "bg-primary" : "bg-primary/30",
                      )}
                      style={{ height: `${height}%` }}
                      data-testid={`mood-bar-${idx + 1}`}
                    />
                    <span className="text-sm">{emojis[idx]}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              共 {totalVotes} 人投票
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
