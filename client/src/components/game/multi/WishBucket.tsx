import { useState } from "react";
import { Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// ── 型別 ──────────────────────────────────────────────
export interface WishEntry extends Record<string, unknown> {
  wishId: string;
  userId: string;
  userName: string;
  wish: string;
  anonymous: boolean;
}

export interface WishBucketConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  placeholder: string;
  maxLength: number;
  anonymous: boolean;
}

export interface WishBucketState extends Record<string, unknown> {
  wishes: WishEntry[];
  revealed: boolean;
}

interface Props {
  config: WishBucketConfig;
  state: WishBucketState;
  userId: string;
  isTeamLead?: boolean;
  onSubmit: (wish: string) => void;
  onReveal: () => void;
}

// ── 元件 ──────────────────────────────────────────────
export function WishBucket({
  config,
  state,
  userId,
  isTeamLead,
  onSubmit,
  onReveal,
}: Props) {
  const [wish, setWish] = useState("");

  const myEntry = state.wishes.find((w) => w.userId === userId);
  const hasSubmitted = !!myEntry;

  function handleSubmit() {
    if (!wish.trim()) return;
    onSubmit(wish.trim());
    setWish("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-yellow-500" />
        <h3 className="font-bold text-lg" data-testid="wb-title">
          {config.title}
        </h3>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="wb-prompt">
        {config.prompt}
      </p>

      <Badge variant="outline" data-testid="wb-count">
        {state.wishes.length} 個願望
      </Badge>

      {!hasSubmitted && (
        <div className="space-y-2">
          <Textarea
            placeholder={config.placeholder}
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            maxLength={config.maxLength}
            rows={3}
            data-testid="wb-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!wish.trim()}
            className="w-full"
            data-testid="wb-submit-btn"
          >
            投入許願桶
          </Button>
        </div>
      )}

      {hasSubmitted && (
        <div
          className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/20"
          data-testid="wb-my-wish"
        >
          <p className="text-xs text-muted-foreground mb-1">我的願望已投入</p>
          <p className="text-sm">{myEntry!.wish}</p>
        </div>
      )}

      {!state.revealed && state.wishes.length === 0 && (
        <p
          className="text-sm text-muted-foreground text-center py-4"
          data-testid="wb-empty"
        >
          許願桶還是空的
        </p>
      )}

      {state.revealed && (
        <div className="space-y-2" data-testid="wb-result">
          <p className="text-sm font-semibold flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            全部願望
          </p>
          {state.wishes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="wb-empty">
              沒有願望
            </p>
          )}
          {state.wishes.map((w) => (
            <div
              key={w.wishId}
              className="border rounded-lg p-3"
              data-testid={`wb-wish-${w.wishId}`}
            >
              <p className="text-sm">{w.wish}</p>
              {!config.anonymous && (
                <p className="text-xs text-muted-foreground mt-1">— {w.userName}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {isTeamLead && !state.revealed && state.wishes.length > 0 && (
        <Button
          onClick={onReveal}
          className="w-full"
          data-testid="wb-reveal-btn"
        >
          開桶揭曉
        </Button>
      )}
    </div>
  );
}

export default WishBucket;
