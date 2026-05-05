// 💌 WishWall — 多人祝福牆元件（純 UI）
// 所有人為指定對象留下祝福訊息，即時美觀呈現
// 適用：生日祝福、婚禮賀詞、離職感謝、結業紀念

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Heart, Send } from "lucide-react";

export interface WishWallConfig {
  title?: string;
  recipientName?: string;
  prompt?: string;
  maxLength?: number;
  showAuthor?: boolean;
}

export interface WishCard {
  id: string;
  userId: string;
  userName: string;
  message: string;
  emoji?: string;
  submittedAt: number;
}

export interface WishWallState extends Record<string, unknown> {
  wishes: WishCard[];
}

const EMOJI_OPTIONS = ["💌", "🎉", "🌸", "💖", "🥂", "✨", "🎊", "🙏"];

interface WishWallProps {
  config: WishWallConfig;
  state: WishWallState;
  myUserId: string;
  myUserName: string;
  onSubmit: (message: string, emoji?: string) => Promise<void>;
}

export default function WishWall({ config, state, myUserId, myUserName: _myUserName, onSubmit }: WishWallProps) {
  const [message, setMessage] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_OPTIONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxLen = config.maxLength ?? 100;
  const showAuthor = config.showAuthor !== false;

  const myWish = state.wishes.find((w) => w.userId === myUserId);
  const hasSubmitted = !!myWish;
  const trimmed = message.trim();

  const handleSubmit = async () => {
    if (!trimmed || isSubmitting || hasSubmitted) return;
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed, selectedEmoji);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="wish-wall-root">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2" data-testid="wish-wall-title">
              <Heart className="w-5 h-5 text-rose-500" />
              {config.title ?? "💌 祝福牆"}
            </CardTitle>
            {state.wishes.length > 0 && (
              <Badge variant="outline" data-testid="wish-count">
                {state.wishes.length} 則祝福
              </Badge>
            )}
          </div>
          {config.recipientName && (
            <p className="text-sm text-muted-foreground" data-testid="wish-recipient">
              送給 <span className="font-semibold text-foreground">{config.recipientName}</span>
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {hasSubmitted ? (
            <div className="py-3 space-y-2" data-testid="wish-submitted">
              <p className="text-sm text-green-600 font-medium text-center">✅ 你的祝福已送出！</p>
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl mb-1">{myWish.emoji}</p>
                <p className="text-sm text-foreground">{myWish.message}</p>
                {showAuthor && <p className="text-xs text-muted-foreground mt-1">— {myWish.userName}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {config.prompt && (
                <p className="text-sm text-muted-foreground">{config.prompt}</p>
              )}
              <div className="flex gap-2 flex-wrap">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setSelectedEmoji(e)}
                    className={`text-xl p-1 rounded transition-transform ${
                      selectedEmoji === e ? "ring-2 ring-primary scale-110" : "hover:scale-105"
                    }`}
                    data-testid={`emoji-btn-${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`寫下你的祝福${config.recipientName ? `給 ${config.recipientName}` : ""}…`}
                className="min-h-[80px] resize-none text-sm"
                maxLength={maxLen}
                data-testid="wish-input"
              />
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>{trimmed.length}/{maxLen}</span>
              </div>
              <Button
                className="w-full"
                onClick={() => void handleSubmit()}
                disabled={!trimmed || isSubmitting}
                data-testid="wish-submit-btn"
              >
                <Send className="w-4 h-4 mr-2" />
                送出祝福
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 祝福牆 */}
      {state.wishes.length > 0 && (
        <div className="grid gap-3" data-testid="wish-wall-grid">
          {state.wishes
            .slice()
            .sort((a, b) => a.submittedAt - b.submittedAt)
            .map((w) => (
              <Card
                key={w.id}
                className="border-rose-100"
                data-testid={`wish-card-${w.id}`}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex gap-3">
                    <span className="text-2xl shrink-0">{w.emoji ?? "💌"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{w.message}</p>
                      {showAuthor && (
                        <p className="text-xs text-muted-foreground mt-1">— {w.userName}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
