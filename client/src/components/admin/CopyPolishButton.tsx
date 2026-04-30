// ✨ 文案優化按鈕（魔法棒）
//
// 用法：放在 textarea / input 旁邊
//   <CopyPolishButton text={value} onApply={(picked) => setValue(picked)} gameId={gameId} />
//
// 點按鈕 → DeepSeek 出 3 個變體 → admin 選喜歡的覆蓋原文
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type CopyStyle =
  | "tactical"
  | "literary"
  | "playful"
  | "formal"
  | "cute"
  | "heroic"
  | "mystery";

const STYLE_LABELS: Record<CopyStyle, string> = {
  tactical: "🎯 戰術",
  literary: "📜 文青",
  playful: "🎮 俏皮",
  formal: "📋 正式",
  cute: "🧸 可愛",
  heroic: "🔥 熱血",
  mystery: "🌫 懸疑",
};

interface CopyPolishButtonProps {
  /** 當前文字 */
  text: string;
  /** 用戶挑選變體後的回呼 */
  onApply: (newText: string) => void;
  /** 用於取場域 OpenRouter key */
  gameId?: string;
  fieldId?: string;
  /** 按鈕大小 */
  size?: "sm" | "default";
  /** test id 前綴 */
  testIdPrefix?: string;
}

interface PolishResult {
  candidates: string[];
  original: string;
  style: CopyStyle;
}

export default function CopyPolishButton({
  text,
  onApply,
  gameId,
  fieldId,
  size = "sm",
  testIdPrefix = "copy-polish",
}: CopyPolishButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<CopyStyle | null>(null);
  const [result, setResult] = useState<PolishResult | null>(null);

  const polishMutation = useMutation({
    mutationFn: async (style: CopyStyle): Promise<PolishResult> => {
      const res = await apiRequest("POST", "/api/admin/copilot/polish-copy", {
        original: text,
        style,
        gameId,
        fieldId,
      });
      return res.json();
    },
    onSuccess: (data, style) => {
      setResult(data);
      setSelectedStyle(style);
    },
    onError: (err: Error) => {
      toast({
        title: "❌ 優化失敗",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleOpen = () => {
    setOpen(true);
    setResult(null);
    setSelectedStyle(null);
  };

  const handlePick = (candidate: string) => {
    onApply(candidate);
    setOpen(false);
    toast({ title: "✓ 已套用", description: candidate.substring(0, 30) });
  };

  // 文字太短 / 太長時 disable
  const canPolish = text.length >= 2 && text.length <= 500;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={size === "sm" ? "icon" : "default"}
        onClick={handleOpen}
        disabled={!canPolish}
        title={
          !canPolish
            ? text.length < 2
              ? "文字太短（至少 2 字）"
              : "文字太長（最多 500 字）"
            : "✨ AI 文案優化"
        }
        className={size === "sm" ? "h-8 w-8 text-purple-500 hover:text-purple-600" : ""}
        data-testid={`button-${testIdPrefix}-trigger`}
      >
        <Sparkles className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>✨ AI 文案優化</DialogTitle>
            <DialogDescription>
              選一個風格讓 DeepSeek 改寫，再挑喜歡的版本套用
            </DialogDescription>
          </DialogHeader>

          {/* 原文預覽 */}
          <div className="bg-muted/50 rounded p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">原文：</p>
            <p>{text}</p>
          </div>

          {/* 風格選擇 */}
          {!result && (
            <div>
              <p className="text-sm font-medium mb-2">選擇風格：</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(STYLE_LABELS) as CopyStyle[]).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    onClick={() => polishMutation.mutate(s)}
                    disabled={polishMutation.isPending}
                    data-testid={`button-${testIdPrefix}-style-${s}`}
                  >
                    {polishMutation.isPending && polishMutation.variables === s ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    ) : null}
                    {STYLE_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 結果預覽 */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{STYLE_LABELS[result.style]} 候選：</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResult(null);
                    setSelectedStyle(null);
                  }}
                  data-testid={`button-${testIdPrefix}-back`}
                >
                  ← 換風格
                </Button>
              </div>
              {result.candidates.map((c, i) => (
                <div
                  key={i}
                  className="border rounded p-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => handlePick(c)}
                  data-testid={`${testIdPrefix}-candidate-${i}`}
                >
                  <p className="text-sm">{c}</p>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => selectedStyle && polishMutation.mutate(selectedStyle)}
                disabled={polishMutation.isPending}
                className="w-full"
                data-testid={`button-${testIdPrefix}-regenerate`}
              >
                {polishMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : null}
                重新生成
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
