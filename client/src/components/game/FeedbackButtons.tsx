// 📊 變體訊息反饋按鈕（玩家端）
//
// 用法：成功/失敗 toast 顯示後，旁邊出現 👍 / 👎 按鈕
//   <FeedbackButtons
//     pageId={page.id}
//     variantKey="success"
//     variantIndex={pickedIndex}
//     variantText={pickedText}
//     gameId={gameId}
//     sessionId={sessionId}
//   />
//
// 行為：
//   - 玩家點 → POST /api/player/feedback（用 UPSERT，重複點覆蓋）
//   - 點完按鈕變色（已反饋）+ disabled 30s（防 spam）
//   - 失敗不擾民（靜默 console.warn）
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface FeedbackButtonsProps {
  pageId: string;
  variantKey: "success" | "fail" | "nearMiss" | "hint";
  variantIndex: number;
  variantText?: string;
  gameId?: string;
  fieldId?: string;
  sessionId?: string;
  /** 是否顯示（picker 抽到 fallback 時不該顯示） */
  enabled?: boolean;
  /** 樣式：'inline'（嵌入訊息底部）/ 'floating'（浮動小按鈕） */
  variant?: "inline" | "floating";
}

type FeedbackAction = "like" | "dislike";

export default function FeedbackButtons({
  pageId,
  variantKey,
  variantIndex,
  variantText,
  gameId,
  fieldId,
  sessionId,
  enabled = true,
  variant = "inline",
}: FeedbackButtonsProps) {
  const [submitted, setSubmitted] = useState<FeedbackAction | null>(null);
  const [pending, setPending] = useState(false);

  // 30s 後重新允許（玩家可以改主意）
  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => setSubmitted(null), 30_000);
    return () => clearTimeout(timer);
  }, [submitted]);

  if (!enabled) return null;

  const sendFeedback = async (action: FeedbackAction) => {
    if (pending) return;
    setPending(true);
    try {
      await apiRequest("POST", "/api/player/feedback", {
        pageId,
        variantKey,
        variantIndex,
        variantText,
        gameId,
        fieldId,
        sessionId,
        action,
      });
      setSubmitted(action);
    } catch (err) {
      // 反饋失敗不擾民
      console.warn("[FeedbackButtons] 送出失敗:", err);
    } finally {
      setPending(false);
    }
  };

  const sizeClass = variant === "floating" ? "h-7 px-2" : "h-8 px-3";
  const iconSize = variant === "floating" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <div
      className={`flex items-center gap-1 ${
        variant === "floating" ? "" : "mt-1.5"
      }`}
      data-testid="feedback-buttons"
    >
      <span className="text-[10px] text-muted-foreground mr-1">
        {submitted ? "✓ 已收到" : "這訊息如何？"}
      </span>
      <Button
        type="button"
        size="sm"
        variant={submitted === "like" ? "default" : "outline"}
        className={sizeClass}
        onClick={() => sendFeedback("like")}
        disabled={pending || !!submitted}
        data-testid="button-feedback-like"
        title="👍 喜歡這訊息"
      >
        <ThumbsUp className={iconSize} />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={submitted === "dislike" ? "destructive" : "outline"}
        className={sizeClass}
        onClick={() => sendFeedback("dislike")}
        disabled={pending || !!submitted}
        data-testid="button-feedback-dislike"
        title="👎 不喜歡"
      >
        <ThumbsDown className={iconSize} />
      </Button>
    </div>
  );
}
