// ⭐ RatingWall — 多項目評分元件（純 UI）
// 所有人對多個項目（如：各組作品/簡報）逐一評 1-5 星
// 即時顯示每個項目的平均分，適合展示評分或選出優勝
// 適用：競賽決選、作品展示、Demo Day、公開評審

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, BarChart2 } from "lucide-react";

export interface RatingItem {
  id: string;
  label: string;
  description?: string;
  emoji?: string;
}

export interface RatingEntry {
  userId: string;
  itemId: string;
  stars: number;
  ratedAt: number;
}

export interface RatingWallConfig {
  title?: string;
  subtitle?: string;
  items: RatingItem[];
  maxStars?: number;
  showResults?: boolean;
}

export interface RatingWallState extends Record<string, unknown> {
  ratings: RatingEntry[];
}

interface RatingWallProps {
  config: RatingWallConfig;
  state: RatingWallState;
  myUserId: string;
  onRate: (itemId: string, stars: number) => Promise<void>;
}

function getAvg(ratings: RatingEntry[], itemId: string): number | null {
  const relevant = ratings.filter((r) => r.itemId === itemId);
  if (relevant.length === 0) return null;
  return relevant.reduce((sum, r) => sum + r.stars, 0) / relevant.length;
}

function getCount(ratings: RatingEntry[], itemId: string): number {
  return ratings.filter((r) => r.itemId === itemId).length;
}

export default function RatingWall({ config, state, myUserId, onRate }: RatingWallProps) {
  const [hovering, setHovering] = useState<{ itemId: string; star: number } | null>(null);
  const maxStars = config.maxStars ?? 5;
  const showResults = config.showResults !== false;

  const myRatings = state.ratings.filter((r) => r.userId === myUserId);
  const ratedCount = myRatings.length;
  const totalItems = config.items.length;
  const allRated = ratedCount >= totalItems;

  const getMyStars = (itemId: string) => myRatings.find((r) => r.itemId === itemId)?.stars ?? 0;

  return (
    <div className="space-y-4" data-testid="rating-wall-root">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-base" data-testid="rating-wall-title">
            {config.title ?? "⭐ 作品評分"}
          </span>
        </div>
        <Badge variant={allRated ? "default" : "outline"} data-testid="rating-progress">
          {ratedCount}/{totalItems} 已評
        </Badge>
      </div>

      {config.subtitle && (
        <p className="text-sm text-muted-foreground" data-testid="rating-subtitle">{config.subtitle}</p>
      )}

      <div className="space-y-3">
        {config.items.map((item) => {
          const myStars = getMyStars(item.id);
          const avg = getAvg(state.ratings, item.id);
          const count = getCount(state.ratings, item.id);
          const isRated = myStars > 0;

          return (
            <Card
              key={item.id}
              className={`transition-all ${isRated ? "border-blue-200 bg-blue-50/30" : ""}`}
              data-testid={`rating-item-${item.id}`}
            >
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start gap-3">
                  {item.emoji && <span className="text-2xl shrink-0">{item.emoji}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                    <div className="flex gap-1 mt-2">
                      {Array.from({ length: maxStars }).map((_, i) => {
                        const starNum = i + 1;
                        const hoverStars = hovering?.itemId === item.id ? hovering.star : null;
                        const filled = hoverStars ? starNum <= hoverStars : starNum <= myStars;
                        return (
                          <button
                            key={starNum}
                            type="button"
                            disabled={isRated}
                            onClick={() => !isRated && void onRate(item.id, starNum)}
                            onMouseEnter={() => !isRated && setHovering({ itemId: item.id, star: starNum })}
                            onMouseLeave={() => setHovering(null)}
                            className="transition-transform hover:scale-110 disabled:cursor-default"
                            data-testid={`rate-star-${item.id}-${starNum}`}
                          >
                            <Star
                              className={`w-6 h-6 transition-colors ${
                                filled ? "fill-amber-400 text-amber-400" : "text-gray-300"
                              }`}
                            />
                          </button>
                        );
                      })}
                      {isRated && (
                        <span className="text-xs text-blue-600 ml-1 self-center" data-testid={`rated-badge-${item.id}`}>
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                  {showResults && avg !== null && (
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-amber-500" data-testid={`avg-score-${item.id}`}>
                        {avg.toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`rate-count-${item.id}`}>
                        {count} 票
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {allRated && (
        <p className="text-xs text-center text-green-600 font-medium" data-testid="rating-complete-msg">
          ✅ 你已完成所有評分！
        </p>
      )}
    </div>
  );
}
