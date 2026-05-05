// ⭐ FeedbackStar — 活動後評分元件（純 UI）
// 玩家星評 + 可選留言，即時顯示平均分與留言
// 適用：任何情境的收尾環節、workshop 回饋、講座評分

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeedbackStarConfig {
  title?: string;
  question?: string;
  allowComment?: boolean;
  maxCommentLength?: number;
}

export interface FeedbackEntry {
  userId: string;
  userName: string;
  stars: number;
  comment?: string;
  submittedAt: number;
}

export interface FeedbackStarState {
  entries: FeedbackEntry[];
}

interface FeedbackStarProps {
  config: FeedbackStarConfig;
  state: FeedbackStarState;
  myUserId: string;
  myUserName: string;
  onSubmit: (stars: number, comment?: string) => Promise<void>;
}

function StarRating({ value, onChange, disabled }: { value: number; onChange?: (v: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          data-testid={`star-btn-${star}`}
          disabled={disabled}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !disabled && setHover(star)}
          onMouseLeave={() => !disabled && setHover(0)}
          className={cn(
            "transition-transform",
            !disabled && "hover:scale-110 cursor-pointer",
            disabled && "cursor-default",
          )}
        >
          <Star
            className={cn(
              "w-8 h-8 transition-colors",
              (hover || value) >= star
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-100 text-gray-300",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackStar({ config, state, myUserId, myUserName, onSubmit }: FeedbackStarProps) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allowComment = config.allowComment !== false;
  const maxLen = config.maxCommentLength ?? 100;

  const myEntry = state.entries.find((e) => e.userId === myUserId);
  const hasSubmitted = !!myEntry;

  const totalEntries = state.entries.length;
  const avgStars = totalEntries > 0
    ? (state.entries.reduce((sum, e) => sum + e.stars, 0) / totalEntries).toFixed(1)
    : null;

  const handleSubmit = async () => {
    if (stars === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(stars, allowComment && comment.trim() ? comment.trim() : undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const recentComments = state.entries
    .filter((e) => e.comment)
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, 5);

  return (
    <div className="space-y-4" data-testid="feedback-star-root">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg" data-testid="feedback-star-title">
              {config.title ?? "⭐ 活動評分"}
            </CardTitle>
            {avgStars && (
              <Badge variant="outline" data-testid="feedback-avg">
                平均 {avgStars} ⭐
              </Badge>
            )}
          </div>
          {config.question && (
            <p className="text-sm text-muted-foreground">{config.question}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {hasSubmitted ? (
            <div className="text-center py-4 space-y-2" data-testid="feedback-submitted">
              <StarRating value={myEntry.stars} disabled />
              <p className="text-sm text-green-600 font-medium">感謝你的評分！</p>
              {myEntry.comment && (
                <p className="text-xs text-muted-foreground">「{myEntry.comment}」</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-center">
                <StarRating value={stars} onChange={setStars} />
              </div>
              {allowComment && (
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="留下一句話（選填）"
                  className="min-h-[60px] resize-none text-sm"
                  maxLength={maxLen}
                />
              )}
              <Button
                className="w-full"
                onClick={() => void handleSubmit()}
                disabled={stars === 0 || isSubmitting}
                data-testid="feedback-submit-btn"
              >
                送出評分
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 統計 */}
      {totalEntries > 0 && (
        <Card data-testid="feedback-stats">
          <CardContent className="pt-4 space-y-2">
            <p className="text-xs text-muted-foreground">共 {totalEntries} 人評分</p>
            {/* 星級分佈 */}
            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map((s) => {
                const count = state.entries.filter((e) => e.stars === s).length;
                const pct = totalEntries > 0 ? (count / totalEntries) * 100 : 0;
                return (
                  <div key={s} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-right">{s}</span>
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                        data-testid={`star-bar-${s}`}
                      />
                    </div>
                    <span className="w-4">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 最近留言 */}
      {recentComments.length > 0 && (
        <Card data-testid="feedback-comments">
          <CardContent className="pt-4 space-y-2">
            <p className="text-xs text-muted-foreground">大家怎麼說</p>
            {recentComments.map((e) => (
              <div key={e.userId} className="text-sm bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-yellow-500">{"★".repeat(e.stars)}</span>
                <span className="text-gray-400">{"☆".repeat(5 - e.stars)}</span>
                <span className="text-muted-foreground ml-1">— {e.userName}</span>
                <p className="text-foreground mt-0.5">{e.comment}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
